import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync';
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import * as path from "path"
import { IGrantable } from 'aws-cdk-lib/aws-iam';


export interface AppSyncLambdaResolverProps {
    api: GraphqlApi,
    name: string,
    type: "Query" | "Mutation",
    fieldName: string,
    secrets?: ISecret[],
    dynamoTables?: Table[]
    lambdas?: AppSyncLambdaResolver[]
    environment?: {[key: string]: string}
}

export class AppSyncLambdaResolver extends Construct {
    public lambda: NodejsFunction;

    constructor(scope: Construct, id: string, props: AppSyncLambdaResolverProps) {
        super(scope, id);
        const namePrefix = props.api.name + '-' + props.name;
        this.lambda = new NodejsFunction(this, namePrefix + "-lambda", {
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
           secret.grantRead(this.lambda); 
        });

        // Grant Read/Write to all supplied tables
        props.dynamoTables?.forEach((table) => {
            table.grantReadWriteData(this.lambda);
        })

        // Grant Invoke to all supplied lambdas
        props.lambdas?.forEach((lambdaFunction) => {
            lambdaFunction.grantInvoke(this);
        })

        // add as a datasource to the api
        const datasource = props.api.addLambdaDataSource(namePrefix + '-datasource',this.lambda)

        // add as resolver for a given field
        datasource.createResolver(namePrefix + "-resolver",{
            typeName: props.type,
            fieldName: props.fieldName
        })
      }

      public grantInvoke(grantee: AppSyncLambdaResolver) {
        this.lambda.grantInvoke(grantee.lambda);
      }

      public getName() {
        return this.lambda.functionName;
      }
}