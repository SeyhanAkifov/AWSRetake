import { APIGatewayProxyEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const snsClient = new SNSClient({});
const ddbClient = new DynamoDBClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const TOPIC_ARN = process.env.TOPIC_ARN!;

export const handler = async (event: APIGatewayProxyEvent) => {
    const { catId, savedUrl } = JSON.parse(event.body || '{}');
    const itemUID = uuidv4();
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
    };
    console.log(JSON.stringify(event));

    try {

        if (!catId || !savedUrl) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: 'Missing catId or savedUrl' }),
            };
        }
        
        await ddbClient.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: { S: `FAVORITECAT#${itemUID.toString()}` },
                SK: { S: `METADATA#${itemUID.toString()}` },
                catId: { S: catId },
                savedUrl: { S: savedUrl },
                updatedAt: { S: new Date().toISOString() },
            }
        }));

        await snsClient.send(new PublishCommand({
            TopicArn: TOPIC_ARN,
            Subject: 'New Favorite Cat 🐱',
            Message: `Lydia has a new favorite cat!\n\nID: ${catId}\nURL: ${savedUrl}`,
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Cat saved and Lydia notified.' }),
        };
    } catch (error) {
        console.error('Error saving cat:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: 'Internal server error ' + error }),
        };
    }
};
