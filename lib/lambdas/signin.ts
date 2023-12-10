import {
    AdminInitiateAuthCommand,
    AuthFlowType,
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
  } from "@aws-sdk/client-cognito-identity-provider";
  import * as crypto from "crypto"

type AuthInput = {
    Username: string,
    Password: string,
    RefreshToken: string,
}

type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        user : AuthInput
    },
    identity: {
        username: string,
        sub: string,
        claims: {
            [key: string]: string[]
        },
        sourceIp: string[]
    }
}

const client = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;
const USER_POOL_CLIENT_SECRET = process.env.USER_POOL_CLIENT_SECRET;

function getSecretHash(username: string) {
    if (USER_POOL_CLIENT_SECRET == undefined) {
        throw new Error('USER_POOL_CLIENT_SECRET Unavailable...');
    }
    return crypto
      .createHmac("sha256", USER_POOL_CLIENT_SECRET)
      .update(`${username}${USER_POOL_CLIENT_ID}`)
      .digest("base64");
  }

async function authenticate(args: AuthInput) {
    const secretHash = getSecretHash(args.Username);    
    if(secretHash == null) {
        throw new Error('An Issue Occured Signing In')
    }
    let command: AdminInitiateAuthCommand;

    if(args.RefreshToken != null) {
        console.log("Utilizing Refresh Token")
        command = new AdminInitiateAuthCommand({
            ClientId: USER_POOL_CLIENT_ID,
            UserPoolId: USER_POOL_ID,
            AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
            AuthParameters: {
                REFRESH_TOKEN: args.RefreshToken,
                SECRET_HASH: secretHash,
            }
        })
    } else if(args.Username != null && args.Password != null) {
        console.log("Authenticating");
        command = new AdminInitiateAuthCommand({
            ClientId: USER_POOL_CLIENT_ID,
            UserPoolId: USER_POOL_ID,
            AuthFlow: AuthFlowType.ADMIN_NO_SRP_AUTH,
            AuthParameters: {
                USERNAME: args.Username,
                PASSWORD: args.Password,
                SECRET_HASH: secretHash,
            },
          });
    } else {
        throw new Error("Invalid Credentials: Please supply either a refresh token or a username and password");
    }

    
    const response = await client.send(command);
    const authResult = response.AuthenticationResult;
    if(authResult == null) {
        throw new Error('An Issue Occured Signing In')
    }
    return {
        AccessToken: authResult.AccessToken,
        IdToken: authResult.IdToken,
        RefreshToken: authResult.RefreshToken,
    }
}
  
export const handler = async(event: AppSyncEvent, context: any) => {
    const user = event.arguments.user;
    return await authenticate(user);
}