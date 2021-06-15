import express from 'express';
import GoogleAuth from 'simple-google-openid';
import * as Model from './model.js';
import multer from 'multer';
import websocket from 'ws';
import http from 'http';
import logConfig from './logConfig.js';
import pkg from 'log4js';
const { configure, getLogger } = pkg;
configure(logConfig);
const log = getLogger();

// Sets up configs for app api's
const app = express();
app.use(express.static('client'));
const CLIENT_ID = '474436150788-dnoko9qcs6rt6hbjrdqh3tgvvlb8d2dp.apps.googleusercontent.com';
app.use(GoogleAuth(CLIENT_ID));
const server = http.createServer(app);
let data;

// Properties for pdf upload
const multerPDF = multer({
  dest: 'data/temp',
  limits: { // limits file size
    fileSize: 1000000000,
  },
});

// Properties for user avatar upload
const multerImage = multer({
  dest: 'data/temp',
  limits: { // limits file size
    fileSize: 1080 * 1080 * 2,
  },
});

/**
   * Function for HTTP route relating to area information
   * @function getAreas will retrieve list of current Areas in database, takes no parameters
   */

async function getAreas(req, res) {
  data = await Model.getAreas();
  return getErrorHandler(data, res);
}

/**
   * Functions for HTTP routes relating to citation information
   * @function listCitations will get all citations attached to a publication, takes a publication uuid as a parameter
   * @function submitNewCitations will attach citation(s) information to a publication, takes an json array of objects
   * @function deleteCitation removes citation from database, accepts citation uuid as a parameter
   */

async function getCitations(req, res) {
  data = await Model.getCitations(req.params);
  return getErrorHandler(data, res);
}

async function submitNewCitations(req, res) {
  data = await Model.submitNewCitations(req.body);
  return notGetErrorHandler(data, res);
}

async function deleteCitation(req, res) {
  data = await Model.deleteCitation(req.params);
  return notGetErrorHandler(data, res);
}

/**
   * Functions for HTTP routes relating to cohort information
   * @function listCohorts will retrieve cohorts from database, takes no parameters
   * @function submitNewCohort will add a new cohort to the database, accepts a JSON object of data
   * @function editCohort will overwrite cohort information in database, accepts a JSON object
   * @function deleteCohort will delete a cohort from the database, takes the cohort's UUID as a parameter
   */

async function getCohorts(req, res) {
  data = await Model.getCohorts(req.params);
  return getErrorHandler(data, res, req.user?.id.toString());
}

async function submitNewCohort(req, res) {
  data = await Model.submitNewCohort(req.body, req.user, req.file);
  return notGetErrorHandler(data, res);
}

async function editCohort(req, res) {
  data = await Model.editCohort(req.body, req.user, req.file);
  return notGetErrorHandler(data, res);
}

async function changeCohortAdmin(req, res) {
  data = await Model.changeCohortAdmin(req.body);
  return notGetErrorHandler(data, res);
}

async function deleteCohort(req, res) {
  data = await Model.deleteCohort(req.params);
  return notGetErrorHandler(data, res);
}

/**
   * @function getCohortUsers will retrieve list of users currently in a cohort/list of cohorts a user is currently in, takes json object as parameter
   * @function addUserToCohort will add a user to a cohort, takes a json object as a parameter
   * @function removeUserFromCohort will remove a user from a cohort, takes a json object as a parameter
   */

async function listFromCohortUsers(req, res) {
  data = await Model.listFromCohortUsers(req.params);
  return getErrorHandler(data, res);
}

async function addUserToCohort(req, res) {
  data = await Model.addUserToCohort(req.body);
  return notGetErrorHandler(data, res);
}

async function removeUserFromCohort(req, res) {
  data = await Model.removeUserFromCohort(req.body);
  return notGetErrorHandler(data, res);
}

/**
   * Functions for HTTP routes relating to comment information
   * @function listComments retrieves all comments on a review, takes review UUID as a parameter
   * @function submitNewComment sends new comment to database, takes a JSON object of relevant data as a parameter
   * @function deleteComment removes comment from database, takes comment UUID as a parameter
   */

async function getComments(req, res) {
  data = await Model.getComments(req.params);
  return getErrorHandler(data, res);
}

async function submitNewComment(req, res) {
  data = await Model.submitNewComment(req.body, req.user);
  return notGetErrorHandler(data, res);
}

async function deleteComment(req, res) {
  data = await Model.deleteComment(req.params);
  return notGetErrorHandler(data, res);
}

/**
   * Functions for HTTP routes relating to notification information
   * @function getNotificationsByUser will list notifications per user, takes json object
   * @function submitNewNotification will add a new notification to the database, takes JSON object as a parameter
   * @function deleteNotification will remove notification from database
   */

async function getNotificationsByUser(req, res) {
  data = await Model.getNotificationsByUser(req.params, req.user);
  return getErrorHandler(data, res);
}

async function submitNewNotification(req, res) {
  data = await Model.submitNewNotification(req.body);
  return notGetErrorHandler(data, res);
}

async function deleteNotification(req, res) {
  data = await Model.deleteNotification(req.params);
  return notGetErrorHandler(data, res);
}

/**
   * Functions for HTTP routes relating to publcation information
   * @function getPubs will get recently uploaded publications, takes a JSON object as a parameter, notes on parameter
   * @function editPublication will overwrite publication data, takes JSON object of relevant information as a parameter
   * @function submitNewPublication will submit a new PDF/link publication to the database, takes JSON object of relevant information as a parameter
   * @function deletePublication will remove a publication and its information from the database, takes publication UUID as a parameter
   */

async function getPubs(req, res) {
  data = await Model.getPubs(req.params);
  return getErrorHandler(data, res, req.user?.id.toString());
}

async function editPublication(req, res) {
  req.file = (typeof req.file !== 'undefined') ? req.file : undefined;
  data = await Model.editPublication(req.body, req.user, req.file);
  return notGetErrorHandler(data, res);
}

async function submitNewPublication(req, res) {
  req.file = (typeof req.file !== 'undefined') ? req.file : undefined;
  data = await Model.submitNewPublication(req.body, req.user, req.file);
  return notGetErrorHandler(data, res);
}

async function deletePublication(req, res) {
  data = await Model.deletePublication(req.params);
  return notGetErrorHandler(data, res);
}

/**
   * Functions for HTTP routes relating to review information
   * @function getOf5 will get only rating/5 for a given publication
   * @function getReviews will get all reviews attached to a publication, takes a publication uuid as a parameter
   * @function submitNewReview will send review to databse with publication ID, takes a JSON object with relevant data
   * @function editReview will overwrite information on a review, takes a JSON object with relevant data
   * @function deleteReview will delete a review from the database, takes a review UUID as a parameter
   */

async function getOf5(req, res) {
  data = await Model.getOf5(req.params);
  return getErrorHandler(data, res);
}

async function getReviews(req, res) {
  data = await Model.getReviews(req.params);
  return getErrorHandler(data, res);
}

async function submitNewReview(req, res) {
  data = await Model.submitNewReview(req.body, req.user);
  return notGetErrorHandler(data, res);
}

async function deleteReview(req, res) {
  data = await Model.deleteReview(req.params);
  return notGetErrorHandler(data, res);
}

/**
   * Functions for HTTP routes relating to user information
   * @function checkUser will Model the database with a google OAuth ID to check if user exists in our database
   * @function newUser will add a new user to our database, takes a google OAuth ID as a parameter
   * @function getUserInfo will retrieve information on a user based on their ID, takes userID as a parameter
   * @function deleteUser will remove a user from the database, takes userID as a parameter
   */

async function checkGoogleUser(req, res) {
  data = await Model.checkGoogleUser(req.user);
  return getErrorHandler(data, res, req.user?.id.toString());
}

async function newGoogleUser(req, res) {
  data = await Model.newGoogleUser(req.user);
  return notGetErrorHandler(data, res);
}

async function getUserInfo(req, res) {
  data = await Model.getUserInfo(req.params);
  return getErrorHandler(data, res, req.user?.id.toString());
}

async function editUserInfo(req, res) {
  req.file = (typeof req.file !== 'undefined') ? req.file : undefined;
  data = await Model.editUserInfo(req.body, req.user, req.file);
  return notGetErrorHandler(data, res);
}

async function deleteUser(req, res) {
  data = await Model.deleteUser(req.user);
  return notGetErrorHandler(data, res);
}

// Function to catch errors in get requests
// Done to avoid repeating codein each function
function getErrorHandler(data, res, user) {
  // Checks if user is null; avoids invalid input syntax
  user = (typeof user !== 'undefined') ? user : undefined;
  log.info(data.length)
  if (data.length === 0) {
    return res.sendStatus(201);
  } else if (data.severity === 'ERROR' || data === 500) {
    return res.sendStatus(404);
  } else {
    return res.json(data);
  }
}

// Function to catch errors in put, post and delete requests
function notGetErrorHandler(data, res, user) {
  // Checks if user is null; avoids invalid input syntax
  user = (typeof user !== 'undefined') ? user : undefined;
  if (data.severity === 'ERROR') {
    return res.sendStatus(404);
  } else {
    return res.json(data);
  }
}

// Function wrapper to handle async errors
function asyncErrorHandler(op) {
  return (request, resolve, next) => {
    Promise.resolve(op(request, resolve, next))
      .catch((error) => next(error || new Error()));
  };
}

/**
 * Route list to set up http routes, listed alphabetically and in get, post, put, delete order
 * @argument area routes relating to areas for publications and users
 * @argument cohort routes relating to cohort properties
 * @argument cohortuser routes relating to members of cohorts
 * @argument comment routes relating to comments on reviews
 * @argument login routes relating to the google signin feature
 * @argument notif routes relating to notification queries
 * @argument publish routes relating to PDF and other publications
 * @argument review routes relating to reviews of PDFs and other publications
 * @argument user routes relating to user profile and display information
 */

app.get('/area/', asyncErrorHandler(getAreas));
app.get('/citation/:id', asyncErrorHandler(getCitations));
app.post('/citation/', express.json(), asyncErrorHandler(submitNewCitations));
app.delete('/citation/:id', asyncErrorHandler(deleteCitation));
app.get('/cohort/:id&:name&:offset', asyncErrorHandler(getCohorts));
app.post('/cohort/', express.json(), multerImage.single('avatar'), asyncErrorHandler(submitNewCohort));
app.put('/cohort/', express.json(), multerImage.single('avatar'), asyncErrorHandler(editCohort));
app.put('/cohort/:user&:cohort', express.json(), asyncErrorHandler(changeCohortAdmin));
app.delete('/cohort/:id', asyncErrorHandler(deleteCohort));
app.get('/cohortuser/:user&:cohort', asyncErrorHandler(listFromCohortUsers));
app.post('/cohortuser/', express.json(), asyncErrorHandler(addUserToCohort));
app.delete('/cohortuser/', express.json(), asyncErrorHandler(removeUserFromCohort));
app.get('/comment/:id', asyncErrorHandler(getComments));
app.post('/comment/', express.json(), asyncErrorHandler(submitNewComment));
app.delete('/comment/:id', asyncErrorHandler(deleteComment));
app.get('/login/', asyncErrorHandler(checkGoogleUser));
app.post('/login/', express.json(), asyncErrorHandler(newGoogleUser));
app.get('/notif/:id&:offset', asyncErrorHandler(getNotificationsByUser));
app.post('/notif/', express.json(), asyncErrorHandler(submitNewNotification));
app.delete('/notif/:id', express.json(), asyncErrorHandler(deleteNotification));
app.get('/publish/:id&:user&:cohort&:title&:offset', asyncErrorHandler(getPubs));
app.post('/publish/', multerPDF.single('file'), express.json(), asyncErrorHandler(submitNewPublication));
app.put('/publish/', multerPDF.single('file'), express.json(), asyncErrorHandler(editPublication));
app.delete('/publish/:id', asyncErrorHandler(deletePublication));
app.get('/rating/:id', asyncErrorHandler(getOf5));
app.get('/review/:id&:offset', asyncErrorHandler(getReviews));
app.post('/review/', express.json(), asyncErrorHandler(submitNewReview));
app.delete('/review/:id', asyncErrorHandler(deleteReview));
app.get('/user/:id&:name&:offset', asyncErrorHandler(getUserInfo));
app.put('/user/', multerImage.single('avatar'), express.json(), asyncErrorHandler(editUserInfo));
app.delete('/user/', express.json(), asyncErrorHandler(deleteUser));

// Creates a new websocket server, handles an event listener for new connections
const wsServer = new websocket.Server({ server: server });
wsServer.on('connection', newConnection);

// Handles new connections to the websocket server
function newConnection(socket) {
  socket.on('message', messageHandler)
}

// Handles messages coming from the websocket server
function messageHandler(e) {
  wsServer.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      try {
        client.send(e);
      } catch (err) {
        log.error(err);
      }
    }
  });
}

// Starts the server on port 8080
server.listen(8080, () => {
  console.log('Server running');
});


/** References in this file:
 * 1: all websocket setup code adapted from https://github.com/portsoc/socket-examples and https://github.com/portsoc/EventedWebSocketMouse
 * 2: @function asyncErrorHandler adapted from https://github.com/portsoc/staged-simple-message-board
 * 3: psql error codes found at https://kb.objectrocket.com/postgresql/postgresql-node-errors-949
 */