'use strict';

const { App } = require('jovo-framework');
const { Alexa } = require('jovo-platform-alexa');
const { GoogleAssistant } = require('jovo-platform-googleassistant');
const { JovoDebugger } = require('jovo-plugin-debugger');
const { FileDb } = require('jovo-db-filedb');
const { Log, LogLevel } = require('jovo-core');

const axios = require('axios');
const cheerio = require('cheerio');
const md5 = require('md5');
const puppeteer = require('puppeteer');

Log.addFileAppender('errors.log', { logLevel: LogLevel.VERBOSE });

// ------------------------------------------------------------------
// APP INITIALIZATION
// ------------------------------------------------------------------

const base_url = 'https://digitalcookie.girlscouts.org/';
const cookie_image_url = 'https://www.girlscouts.org/content/dam/girlscouts-gsusa/images/Cookies/meet-the-cookies/20_MarComm_MeetTheCookies_Graphics_HybridThinMints.jpg';
const cookie_images = { smallImageUrl: cookie_image_url, largeImageUrl: cookie_image_url };

let username = '';
let password = '';

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
  async LAUNCH() {
    let user_id = getUserId(this);
    let user_hash = md5(user_id);
    const credentials = await axios.get('https://cookieorder.org/getlink/' + user_hash).then(res => res.data);
    // If we can get the credentials, return the cookie counts; else return linking prompt
    if(credentials) {
      username = credentials[0];
      password = credentials[1];
      return this.toIntent('CookieCountIntent');
    } else {
      return this.LinkPrompt();
    }
  },

  LinkPrompt() {
    let phone_app = this.isAlexaSkill() ? 'Alexa' : 'Google Assistant';
    let user_hash = md5(getUserId(this));
    let url = 'https://cookieorder.org/link/' + user_hash;
    this.showSimpleCard('Link your account','Visit <a href="' + url + '">' + url + '</a> to link your account')
      .tell('Open the ' + phone_app + ' app on your phone to link your Digital Cookie account.');
  },

  async CookieCountIntent() {
    await getCookieCounts()
      .then( girls => {
        let results = {show:[],tell:[]};
        if(girls.length) {
          for(var i in girls) {
            var girl = girls[i];
            results.tell.push(girl.name + ' has sold ' + girl.sold + ' boxes and has ' + girl.to_sell + ' left to reach her goal of ' + girl.goal + '.');
            results.show.push(girl.name + '\'s goal:  ' + girl.goal + ' boxes\r\n' + girl.sold + ' sold; ' + girl.to_sell + ' left to sell');
          }

          if(results.show.length) {
            this.showStandardCard('Sales Results',results.show.join('\r\n\r\n'),cookie_images)
              .tell(results.tell.join(' '));
          } else {
            this.tell('No results were found. Please try again.');
          }
        } else {
          this.tell('We failed to find the results. Please try again.');
        }
      })
      .catch(e => {
        console.log(e);
        this.tell('There was an error finding the results. Please try again.')
      });
  },

  DeliveryStatusIntent() {
    let box_count = 452;

    this.tell('You have ' + box_count + 'boxes left to deliver.');
  },
});

function getDeviceId(app) {
  return app.$request.context.System.device.deviceId;
}

function getUserId(app) {
  return app.$request.context.System.user.userId || 'unknown-user';
}

function getCookieCounts()
{
  return (async() => {
    let browser;
    try {
      browser = await puppeteerLambda.getBrowser({
        headless: true
      });
      /*
      browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
      */
    } catch(e) {
      browser = await puppeteer.launch();
    }

    const page = await browser.newPage();

    // Log in
    await page.goto(base_url + 'login', {waitUntil: 'networkidle2', timeout: 5000});
    await page.waitForSelector('#username');
    await page.$eval('#username', (el, value) => el.value = value, username);
    await page.$eval('#password', (el, value) => el.value = value, password);
    await page.click('#loginButton');
    console.log('submitting login page');
    try {
      await page.waitForSelector('#scoutList');
    } catch(e) {
      console.log('Timeout while logging in.');
      return [];
    }

    // Now on the dashboard page get the list of girls under this account
    console.log('getting page content');
    let html = await page.content();
    //console.log(html);
    let $ = cheerio.load(html);
    const girls = [];
    $('#scoutList option').each(function() {
      girls.push({
        id: $(this).val(),
        name: $(this).text().replace(/\s+/,' ').trim(),
      });
    });

    // Loop through the girls and get their stats
    for(var i in girls) {
      // if we aren't on this girl's page, navigate there and get the content
      if(page.url().indexOf(girls[i].id) == -1) {
        console.log('navigating to page for ' + girls[i].name);
        await page.goto(base_url + 'scout/' + girls[i].id + '/girlSiteDashboardPage', {waitUntil: 'load'});
        console.log('getting content for for ' + girls[i].name);
        let html = await page.content();
        $ = cheerio.load(html);
      }
      girls[i].goal = $('#cookieGoalsDisplay').text().trim();
      girls[i].sold = $('#totalBoxSalesDisplay').text().trim();
      girls[i].to_sell = $('#totalBoxtoSellDisplay').text().trim();
      girls[i].cookiesData = await page.evaluate(() => cookiesData);
    }

    return girls;
  })();
}

module.exports = { app };
