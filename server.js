/* Setting things up. */
var path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
    tracery = require('tracery-grammar'), 
    request = require('request-promise-native'),
    requests = require('request'),
    assert = require('assert'),
    mime = require('mime'),
    fs = require('fs'),
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
  const grammar = getGrammar();
  const tweetText = generateHotTake(grammar);
  const players = JSON.parse(grammar.toJSON())['player'];
  const playersInTweet = wordsInText(players, tweetText);
  const gifProbability = .75;
  console.log(tweetText);
  if (playersInTweet.length > 0 && Math.random() < gifProbability) {
    // add a gif of the first player mentioned in the tweet
    const player = getFirstPlayerInTweet(tweetText, playersInTweet);
    getRandomGif(player).then(function(gifURLAndDesc) { 
      const gifURL = gifURLAndDesc['url'];
      const gifDescription = gifURLAndDesc['desc'];
      requests.head(gifURL, function(err, res2, body){
      requests(gifURL).pipe(fs.createWriteStream(fileName)).on('close', function() { uploadGifAndPostTweet(tweetText, gifDescription, res); });
    }); } );
  } else {
    T.post('statuses/update', { status: tweetText }, function (err, data, response) {
      if (err){
        console.log('error!', err);
        res.sendStatus(500);
      }
      else{
        res.sendStatus(200);
      }
    });
  }
});

app.all("/" + process.env.SENTENCE_ENDPOINT, function (req, res) {
  res.send(generateHotTake(getGrammar()));
});

app.all("/" + process.env.INSTA_CALLBACK_ENDPOINT, function(req, res) {
  console.log(req);
  res.sendStatus(200);
});

const nicknames = {"Melo": 'Carmelo Anthony', 
                   "Playoff Rondo": 'Rajon Rondo', 
                   "Giannis": 'Giannis Antetokounmpo'
                  }

function wordsInText(words, tweet) {
  var containedWords = [];
  for (let word of words) {
    if (tweet.includes(word)) {
      containedWords.push(word);
    }
  }
  return containedWords;
}

function addHashtags(teams, tweet) {
  var toReturn = tweet;
  const teamsInTweet = wordsInText(teams, tweet);
    const hashtags = {"76ers": "#PhilaUnite", 
                     "Heat": "#WhiteHot", 
                     "Warriors": "#DubNation", 
                     "Spurs": "#GoSpursGo", 
                     "Jazz": "#TakeNote", 
                     "Thunder": "#ThunderUp", 
                     "Rockets": "#Rockets", 
                     "Timberwolves": "#AllEyesNorth",
                     "Pacers": "#Pacers", 
                     "Cleveland Cavaliers": "#AllForOne",
                     "Celtics": "#CUsRise", 
                     "Bucks": "#FearTheDear",
                     "Blazers": "#RipCity", 
                     "Pelicans": "#DoItBigger",
                     "Raptors": "#WeTheNorth", 
                     "Wizards": "#DCFamily",
                     "Dubs": "#DubNation",
                     "Cavs": "#AllForOne"};
    for (let team of teamsInTweet) {
      if (team in hashtags) {
        toReturn += " " + hashtags[team];
      }
    }
  if (teamsInTweet.length == 0) {
    const randomHashtagProbability = 0.5;
    if (Math.random() < randomHashtagProbability) {
      const allHashtags = Object.keys(hashtags);
      toReturn += " " + hashtags[allHashtags[Math.floor(Math.random()*allHashtags.length)]];
    }
  }
  return toReturn;
}

function getGrammar() {
  const grammarFile = require('./grammar.json');
  const grammar = tracery.createGrammar(grammarFile);

  grammar.addModifiers(tracery.baseEngModifiers); 
  return grammar;
}

function generateHotTake(grammar) {
  const sentence = grammar.flatten('#origin#');
  const hotTake = addHashtags(JSON.parse(grammar.toJSON())['team'], sentence);
  return hotTake;
}

const fileName = '/tmp/player.gif';

function uploadGifAndPostTweet(tweetText, gifAltText, originalRequest) {
  // var mediaFilePath = path.join(__dirname, './' + fileName);
  var mediaFilePath = fileName;
  var mediaType = mime.lookup(mediaFilePath);
  var mediaFileSizeBytes = fs.statSync(mediaFilePath).size;
  const callPostTweet = function(err, data, response) {
    return postTweet(tweetText, gifAltText, originalRequest, err, data, response);
  }
  
    T.post('media/upload', {
      'command': 'INIT',
      'media_type': mediaType,
      'total_bytes': mediaFileSizeBytes,
      'media_category': 'tweet_gif'
    }, function (err, bodyObj, resp) {
      assert(!err, err);
      var mediaIdStr = bodyObj.media_id_string;

      var isStreamingFile = true;
      var isUploading = false;
      var segmentIndex = 0;
      var fStream = fs.createReadStream(mediaFilePath, { highWaterMark: 5 * 1024 * 1024 });

      var _finalizeMedia = function (mediaIdStr, cb) {
        T.post('media/upload', {
          'command': 'FINALIZE',
          'media_id': mediaIdStr
        }, cb)
      }

      fStream.on('data', function (buff) {
        fStream.pause();
        isStreamingFile = false;
        isUploading = true;
        console.log('uploading from ' + segmentIndex);

        T.post('media/upload', {
          'command': 'APPEND',
          'media_id': mediaIdStr,
          'segment_index': segmentIndex,
          'media': buff.toString('base64'),
          'content_type': 'application/octet-stream'
        }, function (err, bodyObj, resp) {
          assert(!err, err);
          _finalizeMedia(mediaIdStr, callPostTweet);
          isUploading = false;
        });
      });
 
      fStream.on('end', function () {
        isStreamingFile = false;

        if (!isUploading) {
          _finalizeMedia(mediaIdStr, callPostTweet);
        }
      });
    });
}


const getFirstPlayerInTweet = function(tweet, playersInTweet) {
  var firstPlayer = playersInTweet[0];
  var firstLocation = tweet.indexOf(firstPlayer);
  for (let player of playersInTweet) {
    if (tweet.indexOf(player) < firstLocation) {
      firstLocation = tweet.indexOf(player);
      firstPlayer = player;
    }
  }
  if (firstPlayer in nicknames) {
    return nicknames[firstPlayer];
  }
  return firstPlayer;
}

const postTweet = function (tweetText, gifAltText, originalRequest, err, data, response) {
      // now we can assign alt text to the media, for use by screen readers and
      // other text-based presentations and interpreters

    if (!err) {
      var mediaIdStr = data.media_id_string;
      var altText = gifAltText;
      var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } };
      console.log(altText);

      T.post('media/metadata/create', meta_params, function (err, data, response) {
          if (!err) {
              // now we can reference the media and post a tweet (media will attach to the tweet)
              var params = { status: tweetText, media_ids: [mediaIdStr] };

              T.post('statuses/update', params, function (err, data, response) {
                if (err){
                  console.log('error!', err);
                  if (originalRequest) {
                    originalRequest.sendStatus(500);
                  }
                }
                else{
                  if (originalRequest) {
                    originalRequest.sendStatus(200);
                  }
                }              
              });
          }
        else {
          console.log(err);
          if (originalRequest) {
            originalRequest.sendStatus(500);
          }
        }
      })
    }
  }   

const getRandomGif = function(searchTerm) {
  const searchURL = 'https://api.giphy.com/v1/gifs/search?api_key=' + process.env.GIPHY_API_KEY + '&q='+ searchTerm + '&offset=0&rating=G&lang=en'
  return request.get(searchURL).then(function (response) {
    const data = JSON.parse(response)['data']
    const randomGif = data[Math.floor(Math.random() * data.length)]
    return {'url': randomGif['images']['original']['url'], 'desc': randomGif['title']};
  });
}

function tweet() {
  const grammar = getGrammar();
  const tweetText = generateHotTake(grammar);
  const players = JSON.parse(grammar.toJSON())['player'];
  const playersInTweet = wordsInText(players, tweetText);
  const gifProbability = 1.0;
  console.log(tweetText);
  if (playersInTweet.length > 0 && Math.random() < gifProbability) {
    // add a gif of the first player mentioned in the tweet
    var player = playersInTweet[playersInTweet.length - 1];
    if (player in nicknames) {
      player = nicknames[player];
    }
    getRandomGif(player).then(function(gifURLAndDesc) { 
      const gifURL = gifURLAndDesc['url'];
      const gifDescription = gifURLAndDesc['desc'];
      requests.head(gifURL, function(err, res, body){
      requests(gifURL).pipe(fs.createWriteStream(fileName)).on('close', function() { uploadGifAndPostTweet(tweetText, gifDescription); });
    }); } );
  } else {
    T.post('statuses/update', { status: tweetText }, function (err, data, response) {
        console.log(data); 
      return err;
    });
  }
}

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});
