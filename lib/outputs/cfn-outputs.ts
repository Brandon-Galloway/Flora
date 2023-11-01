import { CfnOutput, Stack } from 'aws-cdk-lib'

export const configureCfnOutputs = (stack: Stack, outputs: Map<string,string>) => {
    let cfnOutputs: CfnOutput[] = []
    for (const [key,value] of outputs) {
        cfnOutputs.push(new CfnOutput(stack,key,{
            value: value
        }))
    }
    return cfnOutputs;
}