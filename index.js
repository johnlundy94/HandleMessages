const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");
const Mailjet = require("node-mailjet");
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);

const sendEmail = async (recipientEmail, subject, textContent, clientId) => {
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
          TextPart: `${textContent}\n\n<!-- ClientId: ${clientId} -->`,
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
    // Differentiate between sending and receiving emails based on the path
    if (event.path === "/messages") {
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
        await sendEmail(email, "New Message from Admin", message, clientId);
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
    } else if (event.path === "/inbound") {
      const requestBody = JSON.parse(event.body);
      const { sender, recipient, subject, text } = requestBody;

      const clientIdMatch = text.match(/<!-- ClientId:\s*(\d+) -->/);
      const clientId = clientIdMatch ? clientIdMatch[1] : null;

      if (!clientId) {
        console.error("ClientId not found in email body");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "ClientId not found in email body",
          }),
        };
      }

      const params = {
        TableName: "Messages",
        Item: {
          messageId: uuidv4(),
          clientId: clientId,
          message: text,
          email: sender,
          subject: subject,
          timestamp: new Date().toISOString(),
        },
      };

      try {
        await dynamoDb.put(params).promise();
        await notifyAdmin(params.Item);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: "Inbound email processed and stored successfully!",
          }),
        };
      } catch (error) {
        console.error("Error saving inbound email:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: "Could not process inbound email",
            details: error.message,
          }),
        };
      }
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
