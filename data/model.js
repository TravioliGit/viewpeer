import Postgres from 'pg';
import config from './config.js';
import fs from 'fs';
import util from 'util';
import path from 'path';
import pkg from 'log4js';
import logConfig from './logConfig.js';
const { configure, getLogger } = pkg;
// Setup some configs for logging, psql and to help with query formatting
configure(logConfig);
const log = getLogger();

fs.renameSync = fs.renameSync || util.promisify(fs.rename); // callback functioned used to re-path a file, adapted from staged-simple-message-board
export const psql = new Postgres.Pool(config);

// PSQL pool event handlers
psql.connect();

psql.on('connect', client => {
  log.info('New Connection: ' + client.user);
});

psql.on('error', (err, client) => {
  log.error('PSQL Fail: ' + err + '. Client error: ' + client);
});

psql.on('remove', () => {
  if (psql.totalCount === 0) {
    psql.end();
  }
});

/** Functions below manipulate queries to format them correctly for PSQL
 * @function filePathAttacher prepares image and pdf files with the correct path and attachment
 * @function selectErrorHandler handles errors in SELECT requests
 * @function notSelectErrorHandler handles errors in INSERT, UPDATE and DELETE requests
 * @function nullConverter converts 'null' into actual null values. due to fetch API stringifying values
 */

export async function filePathAttacher(file, filetype) {
  let newFile;
  const fileExt = file.mimetype.split('/')[1] || filetype;
  const newPath = file.filename + '.' + fileExt;
  // if PDF file, send to publish folder. leaves 'client/' out of return string
  if (filetype === 'pdf') {
    newFile = path.join('client', 'publish', newPath)
    await fs.renameSync(file.path, newFile);
    return newFile.substring(6);
  }
  newFile = path.join('client', 'publish', newPath)
  // if PNG file, send to avatar folder
  path.join('client', 'avatar', newPath)
  await fs.renameSync(file.path, newFile);
  return newFile.substring(6);
}

export async function selectErrorHandler(query, queryConfig) {
  queryConfig = (typeof queryConfig !== 'undefined') ? queryConfig : undefined;
  let result;
  try {
    if (queryConfig === undefined) {
      result = await psql.query(query);
    } else {
      result = await psql.query(query, queryConfig);
    }
    log.info(result.rows)
    return result.rows;
  } catch (e) {
    log.error(e); 
    return e;
  }
}

export async function notSelectErrorHandler(query, queryConfig) {
  queryConfig = (typeof queryConfig !== 'undefined') ? queryConfig : undefined;
  let result;
  try {
    if (!queryConfig === undefined) {
      result = await psql.query(query);
    } else {
      result = await psql.query(query, queryConfig);
    }
    return result;
  } catch (e) {
    log.error(e);
    return e;
  }
}

export function nullConverter(body) {
  Object.keys(body).forEach((key) => {
    log.info(body[key]);  
    if (body[key] === 'null') {
      body[key] = null;
    }
  }); 
  return body;
}

/**
   * The following functions related to areas, and their key parameters, are below:
   * @function getAreas
   * * @param none takes no parameters @returns 
   */

export function getAreas() {
  let query =  `select json_build_object('id', areaID, 'name', areaName) from areaData;`;
  return selectErrorHandler(query);
}

/**
   * The following functions related to citations, and their key parameters, are below:
   * @function listCitations
   * * @param params.id uuid of relevant publication, returns array of rows
   * @function submitNewCitations
   * * @param {object} body array of all citation('s) information, no citation uuid (uuid generated on record insert)
   * @function deleteCitation
   * * @param params.id uuid of citation to be removed
   */

export function getCitations(params) {
  let query =  `select json_build_object('id', citationID, 'link', citationLink, 'text', citationText, 'pub', citationPublish) from citationData where citationPublish = $1;`;
  let queryConfig = [params.id];
  return selectErrorHandler(query, queryConfig);
}

export function submitNewCitations(body) {
  let arrayBody = [], queryConfig = [];
  let query = 'insert into citationData (citationLink, citationText, citationPublish) values ';
  // request is an array of objects; if more than one row, loops through to add extra rows to psql insert
  // setting up this loop took waaaaay longer than i thought, but basically it just repeats the setup string and array for every array it gets
  for (let i = 0; i < body.length; i++) {
    body[i] = nullConverter(body[i]);
    arrayBody.push(body[i]);
    query += `($${(i*3)+1}, $${(i*3)+2}, $${(i*3)+3}), `;
    queryConfig.push(body[i].link, body[i].text, body[i].publish);
  }
  query = query.slice(0, -2) + ';';
  return notSelectErrorHandler(query, queryConfig);
}

export function deleteCitation(params) {
  let query =  'delete from citationData where citationID = $1;';
  let queryConfig = [params.id];
  return notSelectErrorHandler(query, queryConfig);
}

/**
   * The following functions related to cohorts, and their key parameters, are below:
   * @function listCohorts
   * * @param params.id uuid of relevant cohort
   * * @param params.name string, used in search queries
   * * @param params.offset int value, increments of 20
   * @function submitNewCohort
   * * @param {object} body all cohort information, no cohort uuid (uuid generated on record insert)
   * @function editCohort
   * * @param {object} body all cohort information, includes cohort uuid
   * @function changeCohortAdmin
   * * @param {object} body user is new admin oauthid
   * * @param params.id uuid of cohort
   * @function deleteCohort
   * * @param params.id uuid of cohort to be removed
   */

export function getCohorts(params) {
  // if id provided, load info for inspect page
  if (params.id !== 'null') {
    let query =  `select json_build_object('id', cohortID, 'name', cohortName, 'birthday', cohortBirthday, 'desc', cohortDesc, 'avatar', cohortAvatar, 'admin', cohortAdmin, 'adminname', userData.userDisplayName) from cohortData inner join userData on cohortData.cohortAdmin = userData.userID where cohortID = $1;`;
    let queryConfig = [params.id];
    return selectErrorHandler(query, queryConfig);
  }
  // if the name field is supplied, search database for a close match
  if (params.name !== 'null') {
    let query =  `select json_build_object('id', cohortID, 'name', cohortName, 'avatar', cohortAvatar) from cohortData where cohortName ilike $1 order by cohortBirthday desc limit 20 offset $2;`;
    let queryConfig = [params.name + '%', params.offset];
    return selectErrorHandler(query, queryConfig);
  }
  // if neither, get all cohorts
  let query =  `select json_build_object('id', cohortID, 'name', cohortName, 'desc', cohortDesc, 'avatar', cohortAvatar) from cohortData order by cohortBirthday desc limit 20 offset $1;`;
  let queryConfig = [params.offset];
  return selectErrorHandler(query, queryConfig);
}

export async function submitNewCohort(body, user, file) {
  let newPath;
  body = nullConverter(body);
  file = (typeof file !== 'undefined') ? file : undefined;
  if (file !== null) {
    newPath = await filePathAttacher(file, 'png');
  } else {
    newPath = body.avatar;
  }
  let query =  'insert into cohortData (cohortName, cohortDesc, cohortAvatar, cohortAdmin) values ($1, $2, $3, $4);';
  let queryConfig = [body.name, body.desc, newPath, user.id.toString()];
  return notSelectErrorHandler(query, queryConfig);
}

export async function editCohort(body, user, file) {
  let newPath;
  log.info(body, file);
  body = nullConverter(body);
  file = (typeof file !== 'undefined') ? file : null;
  if (file !== null) {
    newPath = await filePathAttacher(file, 'png');
  } else {
    newPath = body.avatar;
  }
  let query =  'update cohortData set cohortName = $1, cohortDesc = $2, cohortAvatar = $3, cohortAdmin = $4 where cohortID = $5;';
  let queryConfig = [body.name, body.desc, newPath, user.id.toString(), body.id];
  return notSelectErrorHandler(query, queryConfig);
}

export function changeCohortAdmin(params) {
  let query =  'update cohortData set cohortAdmin = $1 where cohortID = $2;';
  let queryConfig = [params.user, params.cohort];
  return notSelectErrorHandler(query, queryConfig);
}

export function deleteCohort(params) {
  let query =  'delete from commentData where commentID = $1;';
  let queryConfig = [params.id];
  return notSelectErrorHandler(query, queryConfig);
}

/**
   * The following functions denoting cohort users, and their key parameters, are below:
   * @function listFromCohortUsers
   * * @param params.cohort uuid of cohort, will return array of rows
   * * @param params.user oauth id of user, will return array of rows
   * @function getUserCohorts
   * * @param user.id oauth id of user
   * @function addUserToCohort
   * * @param {object} body uuid of relevant cohort and oauth of relevant user
   * @function removeUserFromCohort
   * * @param {object} body oauthID of user to remove from uuid of cohort
   */

export function listFromCohortUsers(params) {
  if (params.cohort !== 'null') {
    let query =  `select json_build_object('id', userLinkID, 'disp', userData.userDisplayName) from cohortUser inner join userData on cohortUser.userLinkID = userData.userID where cohortLinkID = $1;`;
    let queryConfig = [params.cohort];
    return selectErrorHandler(query, queryConfig);
  }
  let query =  `select json_build_object('id', cohortLinkID, 'name', cohortData.cohortName, 'avatar', cohortData.cohortAvatar) from cohortUser inner join cohortData on cohortUser.cohortLinkID = cohortData.cohortID where userLinkID = $1;`;
  let queryConfig = [params.user];
  return selectErrorHandler(query, queryConfig);
}

export function addUserToCohort(body) {
  let query =  'insert into cohortUser (cohortLinkID, userLinkID) values ($1, $2);';
  let queryConfig = [body.cohort, body.user];
  return notSelectErrorHandler(query, queryConfig);
}

export function removeUserFromCohort(body) {
  log.info(body);
  let query =  'delete from cohortUser where userLinkID = $1;';
  let queryConfig = [body.cohort, body.user];
  return notSelectErrorHandler(query, queryConfig);
}

/**
   * The following functions related to comments, and their key parameters, are below:
   * @function getComments
   * * @param params.id uuid of relevant comment, returns array of rows
   * @function submitNewComment
   * * @param {object} body json object of all request data
   * * @param body.review not null if comment is replying to review
   * * @param body.parent not null if comment is replying to comment
   * * @param user.id id of user posting comment
   * @function deleteComment
   * * @param params.id uuid of comment to be removed
   */

export function getComments(params) {
  let query = `select json_build_object('id', commentID, 'review', reviewID, 'poster', commentPoster, 'content', commentContent, 'time', commentTimestamp, 'dispname', userData.userDisplayName, 'avatar', userData.userAvatar) from commentData inner join userData on commentData.commentPoster = userData.userID where reviewID = $1 order by commentTimestamp desc;`;
  let queryConfig = [params.id];
  return selectErrorHandler(query, queryConfig);
}

export function submitNewComment(body, user) {
  body = nullConverter(body);
  let query =  'insert into commentData (reviewID, commentPoster, commentContent) values ($1, $2, $3);';
  let queryConfig = [body.review, user.id.toString(), body.content];
  return notSelectErrorHandler(query, queryConfig);
}

export function deleteComment(params) {
  let query =  'delete from commentData where commentID = $1;';
  let queryConfig = [params.id];
  return notSelectErrorHandler(query, queryConfig);
}

/**
   * The following functions denoting notifications, and their key parameters, are below:
   * @function getNotificationsByUser 
   * * @param user.id oauthID of user
   * * @param params.id id of notification used in websocket message alerts
   * * @param params.offset int value, increments of 20, used for progressive loading
   * @function submitNewNotification
   * * @param {object} body object of relevant notification information
   * @function deleteNotification
   * * @param params.id uuid of notification to be deleted
   */

export function getNotificationsByUser(params, user) {
  if (params.id !== 'null') {
    // if id is provided, get notification by id
    let query =  `select json_build_object('id', notifID, 'time', notifTimeStamp, 'type', notifType, 'user', notifSenderUser, 'username', userData.userDisplayName, 'cohort', notifSenderCohort, 'cohortname', cohortData.cohortName, 'pub', notifPublish, 'pubtitle', publicationData.publishTitle, 'review', notifReview, 'reviewtext', reviewData.reviewContent, 'comment', notifComment, 'commentcontent', commentData.commentContent, 'recipient', notifRecipient) from notificationData left join userData on notificationData.notifSenderUser = userData.userID left join cohortData on notificationData.notifSenderCohort = cohortData.cohortID left join publicationData on notificationData.notifPublish = publicationData.publishID left join reviewData on notificationData.notifReview = reviewData.reviewID left join commentData on notificationData.notifComment = commentData.commentID where notifID = $1;`;
    let queryConfig = [params.id];
    return selectErrorHandler(query, queryConfig);
  }
  // 5 inner joins, json formatting, proper selection and ordering. it's long, but i am very pleased with this query
  let query =  `select json_build_object('id', notifID, 'time', notifTimeStamp, 'type', notifType, 'user', notifSenderUser, 'username', userData.userDisplayName, 'cohort', notifSenderCohort, 'cohortname', cohortData.cohortName, 'pub', notifPublish, 'pubtitle', publicationData.publishTitle, 'review', notifReview, 'reviewtext', reviewData.reviewContent, 'recipient', notifRecipient) from notificationData left join userData on notificationData.notifSenderUser = userData.userID left join cohortData on notificationData.notifSenderCohort = cohortData.cohortID left join publicationData on notificationData.notifPublish = publicationData.publishID left join reviewData on notificationData.notifReview = reviewData.reviewID where notifRecipient = $1 order by notifTimeStamp desc limit 20 offset $2;`;
  let queryConfig = [user.id.toString(), params.offset];
  return selectErrorHandler(query, queryConfig);
}

export function submitNewNotification(body) {
  body = nullConverter(body);
  let query =  'insert into notificationData (notifID, notifType, notifSenderUser, notifSenderCohort, notifPublish, notifReview, notifRecipient) values ($1, $2, $3, $4, $5, $6, $7);';
  let queryConfig = [body.id, body.type, body.user, body.cohort, body.publish, body.review, body.recipient];
  return notSelectErrorHandler(query, queryConfig);
}

export function deleteNotification(params) {
  let query =  'delete from notificationData where notifID = $1;';
  let queryConfig = [params.id];
  return notSelectErrorHandler(query, queryConfig);
}

/**
   * The following functions related to publications, and their key parameters, are listed below:
   * @function getPubs
   * * @param params.id if not null, used in query to retrieve single publication
   * * @param params.user if not null, used to load publications by userID
   * * @param params.cohort if not null, used to load publications by cohortID
   * * @param params.title if not null, user is searching by publication title
   * * @param params.offset used to load subsequent sets of results
   * @function submitNewPublication
   * * @param file PDF file if it exists in object
   * * @param {object} body ancillary publication information
   * * @param user oauth id of user posting publication
   * @function editPublication
   * * @param file PDF file if it exists in object
   * * @param {object} body ancillary information
   * @function deletePublication
   * * @param params.id uuid of publication to be deleted
   */

export async function getPubs(params) {
  if (params.id !== 'null') {
    // if publication id given, load single publication information
    let query =  `select json_build_object('id', publishID, 'title', publishTitle, 'link', publishLink, 'path', publishPath, 'abstract', publishAbstract, 'dispname', userData.userDisplayName, 'userid', userData.userID, 'cohortname', cohortData.cohortName, 'cohortid', cohortData.cohortID, 'areaname', areaData.areaName, 'time', publishTimestamp) from publicationData inner join userData on publicationData.publishUser = userData.userID left join cohortData on publicationData.publishCohort = cohortData.cohortID left join areaData on publicationData.publishArea = areaData.areaID where publishID = $1;`;
    let queryConfig = [params.id];
    return selectErrorHandler(query, queryConfig);
  }

  if (params.title !== 'null') {
    // if title given, user is searching by publication title
    let query =  `select json_build_object('id', publishID, 'title', publishTitle, 'abstract', publishAbstract, 'dispname', userData.userDisplayName, 'time', publishTimestamp) from publicationData inner join userData on publicationData.publishUser = userData.userID where publishTitle ilike $1 order by publishTimestamp desc limit 20 offset $2;`;
    let queryConfig = [params.title + '%', params.offset];
    return selectErrorHandler(query, queryConfig);
  }
  // if user id given, list publications by user
  if (params.user !== 'null') {
    let query =  `select json_build_object('id', publishID, 'title', publishTitle, 'abstract', publishAbstract, 'time', publishTimestamp, 'dispname', userData.userDisplayName) from publicationData inner join userData on publicationData.publishUser = userData.userID where publishUser = $1 order by publishTimestamp asc;`;
    let queryConfig = [params.user];
    return selectErrorHandler(query, queryConfig);
  }
  // if cohort id given, list publications by cohort
  if (params.cohort !== 'null') {
    let query =  `select json_build_object('id', publishID, 'title', publishTitle) from publicationData inner join cohortData on publicationData.publishCohort = cohortData.cohortID where publishCohort = $1 order by publishTimestamp asc;`;
    let queryConfig = [params.cohort];
    return selectErrorHandler(query, queryConfig);
  }
  // fires for the general feed page, independent of login or search results
  let query =  `select json_build_object('id', publishID, 'title', publishTitle, 'abstract', publishAbstract, 'dispname', userData.userDisplayName, 'time', publishTimestamp) from publicationData inner join userData on publicationData.publishUser = userData.userID order by publishTimestamp asc limit 20 offset $1;`;
  let queryConfig = [params.offset];
  return selectErrorHandler(query, queryConfig);
}

export async function submitNewPublication(body, user, file) {
  log.info(body);
  let newPath;
  file = (typeof file !== 'undefined') ? file : null;
  if (file !== null) {
    newPath = await filePathAttacher(file, 'pdf');
  } else {
    newPath = null;
  }
  body = nullConverter(body);
  let query =  'insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishAbstract, publishArea, publishCohort) values ($1, $2, $3, $4, $5, $6, $7, $8);';
  let queryConfig = [body.id, body.title, user.id.toString(), body.link, newPath, body.abstract, body.area, body.cohort];
  return notSelectErrorHandler(query, queryConfig);
}

export async function editPublication(body, user, file) {
  let newPath;
  file = (typeof file !== 'undefined') ? file : null;
  if (file !== null) {
    newPath = await filePathAttacher(file, 'pdf');
    console.log('newpath,', newPath);
  } else {
    newPath = null;
  }
  body = nullConverter(body);
  let query =  'update publicationData set publishTitle = $1, publishLink = $2, publishPath = $3, publishAbstract = $4, publishArea = $5, publishCohort = $6, publishUser = $7 where publishID = $8;';
  let queryConfig = [body.title, body.link, newPath, body.abstract, body.area, body.cohort, user.id.toString(), body.id];
  return notSelectErrorHandler(query, queryConfig);
}

export function deletePublication(params) {
  log.info(params);
  // due to cascading table setup, this query will also remove all attached citations, reviews and comments from the database too
  let query =  'delete from publicationData where publishID = $1;';
  let queryConfig = [params.id];
  log.info(notSelectErrorHandler(query, queryConfig));
  return notSelectErrorHandler(query, queryConfig);
}

/**
   * The following functions related to reviews, and their key parameters, are below:
   * @function getReviews
   * * @param params.id uuid of relevant publication, returns array of rows
   * * @param params.offset int value for loading subsequent queries
   * @function submitNewReview
   * * @param {object} body all review information, no review uuid (uuid generated on record insert)
   * * @param user.id oauth of user posting review
   * @function deleteReview
   * * @param params.id uuid of review to be removed
   * @function getOf5
   * * @param params.id uuid of publication to retrieve ratings for
   */

export function getReviews(params) {
  let query =  `select json_build_object('id', reviewID, 'content', reviewContent, 'poster', reviewPoster, 'time', reviewTimestamp, 'of5', reviewOf5, 'dispname', userData.userDisplayName, 'avatar', userData.userAvatar) from reviewData inner join userData on reviewData.reviewPoster = userData.userID where reviewPublish = $1 order by reviewTimestamp asc limit 20 offset $2;`;
  let queryConfig = [params.id, params.offset];
  return selectErrorHandler(query, queryConfig);
}

export function getOf5(params) {
  let query =  `select json_build_object('of5', reviewOf5) from reviewData where reviewPublish = $1;`;
  let queryConfig = [params.id];
  return selectErrorHandler(query, queryConfig);
}

export function submitNewReview(body, user) {
  body = nullConverter(body);
  let query =  'insert into reviewData (reviewPublish, reviewContent, reviewPoster, reviewOf5) values ($1, $2, $3, $4);';
  let queryConfig = [body.publish, body.content, user.id.toString(), body.of5];
  return notSelectErrorHandler(query, queryConfig);
}

export function deleteReview(params) {
  // due to cascading table setup, will also delete attached comments
  let query =  'delete from reviewData where reviewID = $1;';
  let queryConfig = [params.id];
  return notSelectErrorHandler(query, queryConfig);
}

/**
   * The following functions related to users/logins, and their key parameters, are below:
   * @function checkGoogleUser safely fails if no id found
   * * @param user.id is a google OAuth id
   * @function newGoogleUser
   * * @param user.id a google OAuth id
   * @function getUserInfo
   * * @param params.id ID of a user
   * * @param params.name name of a user; used in search query
   * @function editUserInfo
   * * @param file a png image file
   * * @param {object} body ancillary user information
   * @function deleteUser
   * * @param user.id a google OAuth id
   */

export function checkGoogleUser(user) {
  if (user === undefined) {return 500}
  let query =  'select (userID) from userData where userID = $1;';
  let queryConfig = [user.id.toString()];
  return selectErrorHandler(query, queryConfig);
}

export function newGoogleUser(user) {
  if (user === undefined) {return 500}
  let query =  `insert into userData (userID, userAvatar) values ($1, 'avatar/placeholder-avatar.png');`;
  let queryConfig = [user.id.toString()];
  return notSelectErrorHandler(query, queryConfig);
}

export function getUserInfo(params) {
  // if name provided, query database for name
  if (params.name !== 'null') {
    let query =  `select json_build_object('id', userID, 'dispname', userDisplayName, 'avatar', userAvatar) from userData where userDisplayName ilike $1 order by userDisplayName desc limit 20 offset $2;`;
    let queryConfig = [params.name + '%', params.offset];
    return selectErrorHandler(query, queryConfig);
  }
  let query =  `select json_build_object('id', userID, 'dispname', userDisplayName, 'fname', userFname, 'lname', userLname, 'email', userEmail, 'avatar', userAvatar, 'about', userAbout) from userData where userID = $1;`;
  let queryConfig = [params.id];
  return selectErrorHandler(query, queryConfig);
}

export async function editUserInfo(body, user, file) {
  file = (typeof file !== 'undefined') ? file : null;
  let newPath;
  if (file !== null) {
    newPath = await filePathAttacher(file, 'png');
  } else {
    newPath = body.avatar;
  }
  body = nullConverter(body);
  let query =  'update userData set userDisplayName = $1, userFname = $2, userLname = $3, userEmail = $4, userAvatar = $5, userAbout = $6 where userID = $7;';
  let queryConfig = [body.display, body.fname, body.lname, body.email, newPath, body.about, user.id.toString()];
  return notSelectErrorHandler(query, queryConfig);
}

export function deleteUser(user) {
  let query =  'delete from userData where userID = $1;';
  let queryConfig = [user.id.toString()];
  return notSelectErrorHandler(query, queryConfig);
}

/** References in this file:
 * 1: heavenly left join knowledge discovered at https://learnsql.com/blog/how-to-left-join-multiple-tables/
 * 2: object loop code adapted from https://zellwk.com/blog/looping-through-js-objects/
 * 3: json_build_object knowledge found at https://stackoverflow.com/questions/26486784/return-as-array-of-json-objects-in-sql-postgres
 * 4: @function fs code and @function filePathAttacher adapted from https://github.com/portsoc/staged-simple-message-board
 */