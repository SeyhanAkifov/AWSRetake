import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";

import * as iam from "aws-cdk-lib/aws-iam";

import * as sqs from "aws-cdk-lib/aws-sqs";

import * as path from "path";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Subscription, Topic } from "aws-cdk-lib/aws-sns";

import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

;
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Stack, StackProps, RemovalPolicy, aws_s3 as s3, aws_s3_deployment as s3deploy, aws_lambda as lambda, aws_apigateway as apigateway, aws_dynamodb as ddb, aws_sns as sns, aws_sns_subscriptions as subs } from 'aws-cdk-lib';


export class RetakeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

     const websiteBucket = new Bucket(this, "StaticWebSiteBucket", {
      websiteIndexDocument: "index.html",
      blockPublicAccess: new BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
       removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(
      this,
      "WebsiteDistribution",
      {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin: new origins.S3StaticWebsiteOrigin(websiteBucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      }
    );

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      destinationBucket: websiteBucket,
      sources: [s3deploy.Source.asset('website')],
    });

    const table = new ddb.Table(this, 'FavoriteCatTable', {
      partitionKey: { name: 'PK', type: ddb.AttributeType.STRING },
      sortKey: { name: 'SK', type: ddb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const topic = new sns.Topic(this, 'FavoriteCatTopic');
    topic.addSubscription(new subs.EmailSubscription('seyhan_akifov@yahoo.com'));

    const saveCatFunction = new lambda.Function(this, 'SaveCatFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'saveCat.handler',
      code: lambda.Code.fromAsset('src'),
      environment: {
        TABLE_NAME: table.tableName,
        TOPIC_ARN: topic.topicArn,
      },
    });

    table.grantReadWriteData(saveCatFunction);
    topic.grantPublish(saveCatFunction);

    const api = new apigateway.RestApi(this, 'FavoriteCatApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    api.root
      .addResource('saveCat')
      .addMethod('POST', new apigateway.LambdaIntegration(saveCatFunction));

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: websiteBucket.bucketWebsiteUrl,
    });

    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: `${api.url}saveCat`,
    });
  }
}
