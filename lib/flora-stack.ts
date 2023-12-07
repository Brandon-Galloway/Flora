import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { FieldLogLevel, GraphqlApi, SchemaFile, AuthorizationType, Definition } from 'aws-cdk-lib/aws-appsync'
import { AccountRecovery, UserPool, UserPoolClient, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito'
import { configureCfnOutputs } from './outputs/cfn-outputs'
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import * as iot from 'aws-cdk-lib/aws-iot'
import { AppSyncLambdaResolver } from './constructs/AppSyncLambdaResolver'
import { IoTLambda } from './constructs/IoTLambda'

export class FloraStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    
    // CONFIGURE USER POOL
    const userPool = new UserPool(this, 'flora-user-pool', {
      selfSignUpEnabled: true,
      accountRecovery: AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE
      },
      autoVerify: {
        email: true,
        phone: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      }
    })

    const userPoolClient = new UserPoolClient(this, "UserPoolClient", {userPool})

    // CONFIGURE DYNAMODB TABLE
    const sensorDataTable = new Table(this,"flora-sensor-data-table",{
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'Id',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'Timestamp',
        type: AttributeType.NUMBER
      },
      timeToLiveAttribute: 'ExpireTimestamp',
    })
    sensorDataTable.addGlobalSecondaryIndex({
      indexName: 'DeviceIndex',
      partitionKey: {
        name: 'DeviceId',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'Timestamp',
        type: AttributeType.NUMBER
      }
    });

    // CONFIGURE GRAPHQL_API
    const api = new GraphqlApi(this, "flora-graphql-api", {
      name: "flora-api",
      logConfig: {
        fieldLogLevel: FieldLogLevel.ALL,
      },
      definition: Definition.fromSchema(SchemaFile.fromAsset('./graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365))
          }
        },
        additionalAuthorizationModes: [
          {
            authorizationType: AuthorizationType.USER_POOL,
            userPoolConfig: {userPool}
          }
        ]
      }
    })

    // Create IoT Policy
    const floraPolicy = new iot.CfnPolicy(this, 'floraPolicy', {
      policyName: 'Flora_Policy',
      policyDocument: {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": ["iot:*"],
              "Resource": ["*"]
            }
          ]
      },
    })

    // RETRIEVE SECRET(s)
    const PERENUAL_API_KEY = Secret.fromSecretNameV2(this,"PERENUAL_API_KEY","PERENUAL_API_KEY");
    const ACCUWEATHER_API_KEY = Secret.fromSecretNameV2(this,"ACCUWEATHER_API_KEY","ACCUWEATHER_API_KEY");

    // CONFIGURE LAMBDA(s)
    const plantLambda = new AppSyncLambdaResolver(this,"AppSyncPlantHandler",{
      api: api,
      name: 'plant',
      type: 'Query',
      fieldName: 'plants',
      secrets: [PERENUAL_API_KEY]
    });

    const weatherLambda = new AppSyncLambdaResolver(this,"AppSyncWeatherHandler",{
      api: api,
      name: 'weather',
      type: 'Query',
      fieldName: 'weather',
      secrets: [ACCUWEATHER_API_KEY]
    });

    // take a look at this as it doesn't have a resolver
    const sensorUploadLambda = new IoTLambda(this,"AppSyncSensorUploadHandler",{
      name: 'sensorUpload',
      topic: "flora/submit",
      environment: {
        SENSOR_DATA_TABLE: sensorDataTable.tableName
      },
      dynamoTables: [sensorDataTable]
    });

    const fetchSensorReadingsLambda = new AppSyncLambdaResolver(this,"AppSyncSensorReadingHandler",{
      api: api,
      name: 'fetchSensorReadings',
      type: 'Query',
      fieldName: 'readings',
      environment: {
        SENSOR_DATA_TABLE: sensorDataTable.tableName
      },
      dynamoTables: [sensorDataTable]
    });

    // CONFIGURE CFN OUTPUT
    const cfnOutputs = configureCfnOutputs(this,new Map([
      ['GraphQLAPIURL',api.graphqlUrl],
      ['AppSyncAPIKey',api.apiKey || ''],
      ['ProjectRegion',this.region],
      ['UserPoolId',userPool.userPoolId],
      ['UserPoolClientId', userPoolClient.userPoolClientId],
    ]))
  }
}
