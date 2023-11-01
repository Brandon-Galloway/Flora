import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import axios  from "axios";
import { LayerVersion } from 'aws-cdk-lib/aws-lambda'
import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";

type SecretResponse = {
    ARN: string,
    CreatedDate: string,
    Name: string,
    SecretBinary: string,
    SecretString: string,
    VersionId: string,
    VersionStages: [string],
    ResultMetadata: any
}

class LambdaSecretHelper {
    
    static lambdaParametersAndSecretsExtensionARN = 'arn:aws:lambda:us-east-2:590474943231:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11'
    static SECRETS_EXT_PORT = '2773'

    static async getSecretByArn(AWS_SESSION_TOKEN: string,id: string): Promise<SecretResponse> {
        const secretsUrl = `http://localhost:${LambdaSecretHelper.SECRETS_EXT_PORT}/secretsmanager/get?secretId=${id}`
        const config = {
            headers: {'X-Aws-Parameters-Secrets-Token': AWS_SESSION_TOKEN},
        }
        const secretValue = await axios.get(secretsUrl,config)
        return secretValue.data
    }

    static configureSecretsForLambda(stack: Stack,lambda: NodejsFunction,authorizedSecrets: ISecret[]) {
        lambda.addLayers(LayerVersion.fromLayerVersionArn(stack,lambda.functionName+'SecretLayer',this.lambdaParametersAndSecretsExtensionARN))
        lambda.addEnvironment('PARAMETERS_SECRETS_EXTENSION_HTTP_PORT',LambdaSecretHelper.SECRETS_EXT_PORT)
        lambda.addToRolePolicy(
            new PolicyStatement({
              actions: ['ssm:GetParameter'],
              resources: ['*']
            })
        )
        authorizedSecrets.forEach(secret => {
            secret.grantRead(lambda)
        })
    }
}

export default LambdaSecretHelper;