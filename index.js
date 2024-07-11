const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");
const Mailjet = require("node-mailjet");
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);

const sendEmail = async (recipientEmail, subject, textContent) => {
  try {
    const request = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: "admin@verdantvisionslandscapingadmin.com",
            Name: "Admin",
          },
          To: [
            {
              Email: recipientEmail,
              Name: "Client",
            },
          ],
          Subject: subject,
          TextPart: textContent,
        },
      ],
    });
    console.log("Email sent:", request.body);
  } catch (err) {
    console.error("Error sending email:", err);
  }
};

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "CORS preflight check successful",
      }),
    };
  }

  if (event.httpMethod === "POST") {
    const requestBody = JSON.parse(event.body);
    const { clientId, message, email } = requestBody;

    const params = {
      TableName: "Messages",
      Item: {
        messageId: uuidv4(),
        clientId: clientId,
        message: message,
        email: email,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await dynamoDb.put(params).promise();
      await sendEmail(email, "New Message from Admin", message);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "Message saved and email sent successfully!",
        }),
      };
    } catch (error) {
      console.error("Error saving message or sending email:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Could not save message or send email",
          details: error.message,
        }),
      };
    }
  } else if (event.httpMethod === "GET") {
    const { email } = event.pathParameters;
    const params = {
      TableName: "Messages",
      FilterExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email },
    };

    try {
      const data = await dynamoDb.scan(params).promise();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data.Items),
      };
    } catch (error) {
      console.error("Error fetching messages:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Could not fetch messages",
          details: error.message,
        }),
      };
    }
  } else {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Unsupported HTTP method" }),
    };
  }
};
