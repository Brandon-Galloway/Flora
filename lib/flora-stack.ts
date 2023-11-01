import * as cdk from 'aws-cdk-lib'
import { FieldLogLevel, GraphqlApi, SchemaFile, AuthorizationType, Definition } from 'aws-cdk-lib/aws-appsync'
import { AccountRecovery, UserPool, UserPoolClient, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import * as path from "path"
import { configureCfnOutputs } from './outputs/cfn-outputs'
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import LambdaSecretHelper from './util/utils'

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
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      }
    })

    const userPoolClient = new UserPoolClient(this, "UserPoolClient", {userPool})

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

    // RETRIEVE SECRET(s)
    const PERENUAL_API_KEY = Secret.fromSecretAttributes(this, "PERENUAL_API_KEY", {
      secretCompleteArn:
        "arn:aws:secretsmanager:us-east-2:391751429626:secret:PERENUAL_API_KEY-5pR0AZ"
    })

    const ACCUWEATHER_API_KEY = Secret.fromSecretAttributes(this, "ACCUWEATHER_API_KEY", {
      secretCompleteArn:
        "arn:aws:secretsmanager:us-east-2:391751429626:secret:ACCUWEATHER_API_KEY-jTft6J"
    })

    // CONFIGURE LAMBDA(s)

    // const plantLambda = new Function(this, "AppSyncPlantHandler", {
    //   runtime: Runtime.NODEJS_18_X,
    //   handler: "main.handler",
    //   code: Code.fromAsset('lambdas')
    // });

    const plantLambda = new NodejsFunction(this, "AppSyncPlantHandler", {
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: path.join(__dirname, `../lib/lambdas/plant.ts`),
      environment: {
        TEST_VARIABLE: 'This is an environment variable!',
        PERENUAL_API_KEY_ID: PERENUAL_API_KEY.secretName
      },
    })
    LambdaSecretHelper.configureSecretsForLambda(this,plantLambda,[PERENUAL_API_KEY])

    const weatherLambda = new NodejsFunction(this, "AppSyncWeatherHandler", {
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: path.join(__dirname, `../lib/lambdas/weather.ts`),
      environment: {
        ACCUWEATHER_API_KEY_ID: ACCUWEATHER_API_KEY.secretName
      },
    })
    LambdaSecretHelper.configureSecretsForLambda(this,weatherLambda,[ACCUWEATHER_API_KEY])

    // Set the Lambda function as a data source for the AppSync API
    const plantDataSource = api.addLambdaDataSource('plantDataSource',plantLambda)
    const weatherDataSource = api.addLambdaDataSource('weather',weatherLambda)

    plantDataSource.createResolver("plant-resolver",{
      typeName: "Query",
      fieldName: "plant"
    })

    plantDataSource.createResolver("superPlant-resolver",{
      typeName: "Query",
      fieldName: "superPlant"
    })

    weatherDataSource.createResolver("weather-resolver",{
      typeName: "Query",
      fieldName: "weather"
    })

    // CONFIGURE CFN OUTPUT
    const cfnOutputs = configureCfnOutputs(this,new Map([
      ['GraphQLAPIURL',api.graphqlUrl],
      ['AppSyncAPIKey',api.apiId || ''],
      ['ProjectRegion',this.region],
      ['UserPoolId',userPool.userPoolId],
      ['UserPoolClientId', userPoolClient.userPoolClientId]
    ]))
  }
}
