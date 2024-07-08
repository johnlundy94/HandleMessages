const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");

exports.handler = async (event) => {
  if (event.httpMethod === "POST") {
    const requestBody = JSON.parse(event.body);
    const { clientId, message } = requestBody;

    const params = {
      TableName: "Messages",
      Item: {
        messageId: uuidv4(),
        clientId: clientId,
        message: message,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await dynamoDb.put(params).promise();
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Message saved successfully!" }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Could not save message",
          details: error.message,
        }),
      };
    }
  } else if (event.httpMethod === "GET") {
    const params = {
      TableName: "Messages",
    };

    try {
      const data = await dynamoDb.scan(params).promise();
      return {
        statusCode: 200,
        body: JSON.stringify(data.Items),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Could not fetch messages",
          details: error.message,
        }),
      };
    }
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Unsupported HTTP method" }),
    };
  }
};
