import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { RemovalPolicy, aws_s3 as s3, aws_s3_deployment as s3deploy, aws_lambda as lambda, aws_apigateway as apigateway, aws_dynamodb as ddb, aws_sns as sns, aws_sns_subscriptions as subs } from 'aws-cdk-lib';
import { LambdaIntegration} from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from "path";
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class RetakeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const websiteBucket = new Bucket(this, "StaticWebSiteBucket", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
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

    const saveCatFunction = new NodejsFunction(this, "PostTableFunction", {
      entry: path.join(__dirname, "../src/saveCat.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
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

    const catApi = api;
    const catapiressourse = catApi.root.addResource("saveCat");

    const orderapipost = catapiressourse.addMethod(
      "POST",
      new LambdaIntegration(saveCatFunction, { proxy: true })
    );
    
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: websiteBucket.bucketWebsiteUrl,
    });

    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: `${api.url}saveCat`,
    });
  }
}
