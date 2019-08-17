const express = require("express");
const bodyParser = require("body-parser");
const ngrok = require("ngrok");
const decodeJWT = require("did-jwt").decodeJWT;
const { Credentials } = require("uport-credentials");
const transports = require("uport-transports").transport;
const message = require("uport-transports").message.util;
const cors = require("cors");

const generatedId = Credentials.createIdentity();

let endPoint = "";
const app = express();
app.use(bodyParser.json({ type: "*/*" }));
app.use(cors());

let state = {
  FIRSTNAME: "",
  LASTNAME: "",
  "DATE OF BIRTH": "",
  "UNIQUE ID NO": ""
};

const credentials = new Credentials({
  appName: "uport-example-app",
  ...generatedId
});

app.post("/", (req, res) => {
  state = req.body;
  credentials
    .createDisclosureRequest({
      requested: ["name"],
      notifications: true,
      callbackUrl: endPoint + "/callback"
    })
    .then(requestToken => {
      console.log(decodeJWT(requestToken));
      const uri = message.paramsToQueryString(
        message.messageToURI(requestToken),
        { callback_type: "post" }
      );
      const qr = transports.ui.getImageDataURI(uri);
      res.send({ qr });
    });
});

app.post("/callback", (req, res) => {
  const jwt = req.body.access_token;
  credentials
    .authenticateDisclosureResponse(jwt)
    .then(creds => {
      console.log("Credentials: ", creds);
      const push = transports.push.send(creds.pushToken, creds.boxPub);
      credentials
        .createVerification({
          sub: creds.did,
          exp: Math.floor(new Date().getTime() / 1000) + 30 * 24 * 60 * 60,
          claim: { "VOTER ID": { ...state } }
        })
        .then(attestation => {
          console.log(`Encoded JWT sent to user: ${attestation}`);
          console.log(
            `Decodeded JWT sent to user: ${JSON.stringify(
              decodeJWT(attestation)
            )}`
          );
          return push(attestation);
        })
        .then(res => {
          console.log(res);
          console.log(
            "Push notification sent and should be recieved any moment..."
          );
          console.log(
            "Accept the push notification in the uPort mobile application"
          );
          ngrok.disconnect();
        });
    })
    .catch(err => {
      console.log(err);
    });
});

const server = app.listen(8088, () => {
  ngrok.connect(8088).then(ngrokUrl => {
    endPoint = ngrokUrl;
    console.log(`Login Service running, open at ${endPoint}`);
  });
});
