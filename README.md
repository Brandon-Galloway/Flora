# Flora API
![Last Commit](https://img.shields.io/github/last-commit/Brandon-Galloway/Flora/master)
![AWS CDK](https://img.shields.io/badge/AWS_CDK-2.114.1-blue)

## Overview
The Flora API is an AWS CDK project deploying a suite of AWS resources to configure data storage, authentication, authorization, messaging, and a backend api for the purpose of collecting and monitoring houseplant data.

<details closed>
<summary> Future Enhancements </summary>  

- Automatic client registration
- Data Analysis: event generation
- [Plant.id](https://web.plant.id/plant-identification-api/) ML Integration
- Generate plant recommendations
- SMS Notifications
- Mobile App Integration (Amplify)
</details>

## Flora Client
Clients can be registered by completing the installations steps below followed by the client installation steps detailed [here](https://github.com/Brandon-Galloway/Flora-Client/blob/master/README.md) for each client.

## Optional Configuration
Create a .env file at the project root
```shell
touch .env
```
Provide optional parameters
```shell
CUSTOM_URL='api.example.com'
CUSTOM_URL_CERTIFICATE_ARN=''
CALLBACK_URLS='https:www.google.com,https://api.example.com/callback'
LOGOUT_URLS='https://api.example.com/logout'
```

## Installation

### Clone Project
```shell
git clone https://github.com/Brandon-Galloway/Flora.git
```

### Install Dependencies
```shell
npm install
```

### Authenticate with AWS
Establish how the AWS CDK authenticates with AWS. (See [AWS Documentation](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html))  

\* Also see [Authentication and Access](https://docs.aws.amazon.com/sdkref/latest/guide/access.html)

### Configure Secrets
Login to your AWS account and navigate to AWS Secrets Manager. Configure two secrets:  

- ACCUWEATHER_API_KEY: Your [Accuweather API Key](https://developer.accuweather.com/getting-started)
- PERENUAL_API_KEY: [Your Perenual API Key](https://perenual.com/docs/api)


## Deployment
The following command will deploy all associated project resources to your AWS account's default region:
```shell
npm run deploy
```
\* This command aliases ```cdk deploy -O ./cdk-exports.json```

Additional configuration may be required for optional custom domains.  
(See [AWS Documentation](https://aws.amazon.com/blogs/mobile/introducing-custom-domain-names-for-aws-appsync-apis/))

## Exports
Following deployment, ```cdk-exports.json``` will be created in your project root. This file contains helpful exports for utilizing your newly deployed application detailed below.  
\* **This file should** ***NOT*** **be shared.**

```shell
{
  "FloraStack": {
    # The ID of your user pool. You can add new users here
    "UserPoolId": "",
    # Your API Key. This is required to access API Signin
    "AppSyncAPIKey": "",
    # The ID of your Machine-To-Machine User Pool OAuth Client
    "UserPoolClientId": "", 
    # The URL of your deployed graphql api
    "GraphQLAPIURL": "",
    # The region your project was deployed to
    "ProjectRegion": ""
  }
}
```

## Verification
Following these steps, your aws account should show a new CloudFormation Stack "FloraStack". A list of resources should be available under that stack detailing a comprehensive list of deployed resources. Navigating to "AWS Appsync" should show a new api "flora-api" available. Selecting "Queries" will open a web client where you can verify each endpoint is operating as expected.

## Contributors
Brandon Galloway
