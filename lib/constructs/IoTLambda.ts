import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import * as iot from 'aws-cdk-lib/aws-iot'
import * as path from "path"
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam'


export interface IoTLambdaProps {
    name: string,
    topic: string
    secrets?: ISecret[],
    dynamoTables?: Table[]
    environment?: {[key: string]: string}
}

export class IoTLambda extends Construct {

    constructor(scope: Construct, id: string, props: IoTLambdaProps) {
        super(scope, id);
        const namePrefix = 'iot-' + props.name;

        const lambda = new NodejsFunction(this, namePrefix + "-lambda", {
            runtime: Runtime.NODEJS_18_X,
            handler: "handler",
            entry: path.join(__dirname, `../lambdas/${props.name}.ts`),
            environment: {
                ...props.secrets?.reduce((entry,secret) => {
                    entry[secret.secretName] = secret.secretName;
                    return entry;
                }, {} as Record<string,string>),
                ...props.environment
            }
          })

        // Grant Access to all supplied secrets
        props.secrets?.forEach((secret) => {
           secret.grantRead(lambda); 
        });

        props.dynamoTables?.forEach((table) => {
            table.grantReadWriteData(lambda);
        })

        // Create IoT Rule to Pass Messages to the upload lambda
        const dataSubmissionRule = new iot.CfnTopicRule(this, namePrefix + '-dataSubmissionRule', {
            ruleName: (namePrefix + '-dataSubmissionRule').replace(/-/g, "_"),
            topicRulePayload: {
            actions: [
                {
                lambda: {
                    functionArn: lambda.functionArn
                }
                },
            ],
            ruleDisabled: false,
            sql: `SELECT * FROM '${props.topic}'`,
            }
        })

        lambda.addPermission('IoTAccess', {
            principal: new ServicePrincipal("iot.amazonaws.com"),
            action: 'lambda:InvokeFunction',
            sourceArn: dataSubmissionRule.attrArn
          })

      }
}