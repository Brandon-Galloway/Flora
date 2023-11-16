import * as cdk from 'aws-cdk-lib'
import * as path from "path"
import { Construct } from 'constructs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { FieldLogLevel, GraphqlApi, SchemaFile, AuthorizationType, Definition } from 'aws-cdk-lib/aws-appsync'
import { AccountRecovery, UserPool, UserPoolClient, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito'
import { configureCfnOutputs } from './outputs/cfn-outputs'
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import * as iot from 'aws-cdk-lib/aws-iot'
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam'

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
      timeToLiveAttribute: 'ExpireTimestamp'
    })

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

    const floraUploadTopic = "flora/submit"

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
    const plantLambda = new NodejsFunction(this, "AppSyncPlantHandler", {
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: path.join(__dirname, `../lib/lambdas/plant.ts`),
      environment: {
        PERENUAL_API_KEY_ID: "PERENUAL_API_KEY"
      },
    })
    PERENUAL_API_KEY.grantRead(plantLambda);

    const weatherLambda = new NodejsFunction(this, "AppSyncWeatherHandler", {
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: path.join(__dirname, `../lib/lambdas/weather.ts`),
      environment: {
        ACCUWEATHER_API_KEY_ID: "ACCUWEATHER_API_KEY"
      },
    })
    ACCUWEATHER_API_KEY.grantRead(weatherLambda);

    const sensorUploadLambda = new NodejsFunction(this, "SensorUploadHandler", {
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: path.join(__dirname, `../lib/lambdas/sensorUpload.ts`),
      environment: {
        SENSOR_DATA_TABLE: sensorDataTable.tableName
      },
    })
    sensorDataTable.grantReadWriteData(sensorUploadLambda);

    // Set the Lambda function as a data source for the AppSync API
    const plantDataSource = api.addLambdaDataSource('plantDataSource',plantLambda)
    const weatherDataSource = api.addLambdaDataSource('weather',weatherLambda)

    plantDataSource.createResolver("plant-resolver",{
      typeName: "Query",
      fieldName: "plants"
    })

    weatherDataSource.createResolver("weather-resolver",{
      typeName: "Query",
      fieldName: "weather"
    })

    // Create IoT Rule to Pass Messages to the creation lambda
    const floraDataSubmissionRule = new iot.CfnTopicRule(this, 'FloraDataSubmissionRule', {
      ruleName: 'FloraDataSubmissionRule',
      topicRulePayload: {
        actions: [
          {
            lambda: {
              functionArn: sensorUploadLambda.functionArn
            }
          },
        ],
        ruleDisabled: false,
        sql: `SELECT * FROM '${floraUploadTopic}'`,
      }
    })
    sensorUploadLambda.addPermission('IoTAccess', {
      principal: new ServicePrincipal("iot.amazonaws.com"),
      action: 'lambda:InvokeFunction',
      sourceArn: floraDataSubmissionRule.attrArn
    })

    // CONFIGURE CFN OUTPUT
    const cfnOutputs = configureCfnOutputs(this,new Map([
      ['GraphQLAPIURL',api.graphqlUrl],
      ['AppSyncAPIKey',api.apiId || ''],
      ['ProjectRegion',this.region],
      ['UserPoolId',userPool.userPoolId],
      ['UserPoolClientId', userPoolClient.userPoolClientId],
    ]))
  }
}
