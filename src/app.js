'use strict';

const { App } = require('jovo-framework');
const { Alexa } = require('jovo-platform-alexa');
const { GoogleAssistant } = require('jovo-platform-googleassistant');
const { JovoDebugger } = require('jovo-plugin-debugger');
const { FileDb } = require('jovo-db-filedb');

// ------------------------------------------------------------------
// APP INITIALIZATION
// ------------------------------------------------------------------

const app = new App();

app.use(
  new Alexa(),
  new GoogleAssistant(),
  new JovoDebugger(),
  new FileDb()
);

// ------------------------------------------------------------------
// APP LOGIC
// ------------------------------------------------------------------

app.setHandler({
  LAUNCH() {
    return this.toIntent('CookieCountIntent');
  },

  CookieCountIntent() {
    let box_count = 999;

    this.tell('You have sold ' + box_count + ' boxes.');
  },

  DeliveryStatusIntent() {
    let box_count = 452;

    this.tell('You have ' + box_count + 'boxes left to deliver.');
  },
});

module.exports = { app };
