'use strict';

const { ExpressJS, WebhookVerified: Webhook } = require('jovo-framework');
const { app } = require('./app.js');
const fs = require('fs');

// ------------------------------------------------------------------
// HOST CONFIGURATION
// ------------------------------------------------------------------

// ExpressJS (Jovo Webhook)
if (process.argv.indexOf('--webhook') > -1) {
  const port = process.env.JOVO_PORT || 3000;
  Webhook.jovoApp = app;

  Webhook.ssl = {
    key: fs.readFileSync('/home/ubuntu/key.pem'),
    cert: fs.readFileSync('/home/ubuntu/cert.pem'),
  };

  Webhook.listen(port, () => {
    console.info(`Local server listening on port ${port}.`);
  });

  Webhook.post(['/webhook','/webhook_alexa'], async (req, res) => {
    await app.handle(new ExpressJS(req, res));
  });
}

// AWS Lambda
exports.handler = async (event, context, callback) => {
  await app.handle(new Lambda(event, context, callback));
};
