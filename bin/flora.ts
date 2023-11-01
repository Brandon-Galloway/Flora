#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FloraStack } from '../lib/flora-stack';

const app = new cdk.App();
new FloraStack(app, 'FloraStack', {
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  // env: { account: '123456789012', region: 'us-east-1' },
});