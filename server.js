/* Setting things up. */
var path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
    tracery = require('tracery-grammar'), 
    config = {
    /* Be sure to update the .env file with your API keys. See how to get them: https://botwiki.org/tutorials/how-to-create-a-twitter-app */      
      twitter: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        access_token: process.env.ACCESS_TOKEN,
        access_token_secret: process.env.ACCESS_TOKEN_SECRET
      }
    },
    T = new Twit(config.twitter);

app.use(express.static('public'));

/* You can use uptimerobot.com or a similar site to hit your /BOT_ENDPOINT to wake up your app and make your Twitter bot tweet. */

app.all("/" + process.env.BOT_ENDPOINT, function (req, res) {
  T.post('statuses/update', { status: generateTweet() }, function(err, data, response) {
    if (err){
      console.log('error!', err);
      res.sendStatus(500);
    }
    else{
      res.sendStatus(200);
    }
  });
});

app.all("/" + process.env.SENTENCE_ENDPOINT, function (req, res) {
  res.send(generateTweet());
});

function containsTeam(tweet) {
  const teams = ["Boston Celtics", "Brooklyn Nets", "New York Knicks", "Philadelphia 76ers", "Toronto Raptors", 
                 "Chicago Bulls", "Cleveland Cavaliers", "Detroit Pistons", "Indiana Pacers", "Milwaukee Bucks", 
                 "Atlanta Hawks", "Charlotte Hornets", "Miami Heat", "Orlando Magic", "Washington Wizards", 
                 "Denver Nuggets", "Minnesota Timberwolves", "Oklahoma City Thunder", "Portland Trail Blazers", 
                 "Utah Jazz", "Golden State Warriors", "Los Angeles Clippers", "Los Angeles Lakers", "Phoenix Suns", 
                 "Sacramento Kings", "Dallas Mavericks", "Houston Rockets", "Memphis Grizzlies", "New Orleans Pelicans", 
                 "San Antonio Spurs"];
  for (let team of teams) {
    if (tweet.includes(team)) {
      return true;
    }
  }
  return false;
}

function addHashtag(tweet) {
  var toReturn = tweet;
    const hashtags = {"Philadelphia": "#PhilaUnite", 
                     "Miami": "#WhiteHot", 
                     "Warriors": "#DubNation", 
                     "Spurs": "#GoSpursGo", 
                     "Jazz": "#TakeNote", 
                     "Thunder": "#ThunderUp", 
                     "Houston": "#Rockets", 
                     "Timberwolves": "#AllEyesNorth",
                     "Pacers": "#Pacers", 
                     "Cleveland": "#AllForOne",
                     "Celtics": "#CUsRise", 
                     "Bucks": "#FearTheDear",
                     "Portland": "#RipCity", 
                     "Pelicans": "#DoItBigger",
                     "Toronto": "#WeTheNorth", 
                     "Wizards": "#DCFamily"};
    for (let hashtagKey of Object.keys(hashtags)) {
      if (tweet.includes(hashtagKey)) {
        toReturn += " " + hashtags[hashtagKey];
      }
    }
  if (!containsTeam(tweet)) {
    const allHashtags = Object.keys(hashtags);
    toReturn += " " + hashtags[allHashtags[Math.floor(Math.random()*allHashtags.length)]];
  }
  return toReturn;
}

function generateTweet() {
  var grammarFile = require('./grammar.json');
  var grammar = tracery.createGrammar(grammarFile);

  grammar.addModifiers(tracery.baseEngModifiers); 

  const tweetDraft = grammar.flatten('#origin#');
  const tweet = addHashtag(tweetDraft);
  return tweet;
}

function tweet() {
  tweet = generateTweet();
  console.log(tweet);
  T.post('statuses/update', { status: tweet }, function (err, data, response) {
      console.log(data); 
    return err;
  });
}

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});
