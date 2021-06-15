/* eslint-disable quote-props */
// Global configs, variables, etc
import * as View from './view/view.js';
import { getEl } from './elements.js';
let el = getEl();
const ws = new WebSocket('ws://' + window.location.hostname + ':' + window.location.port + '/');

/** The functions listed below serve to handle ancillary application data manipulation with no real effect on page elements 
 * @function fileUploadValidator validates file input (png, pdf)
 * @function authChangeHandler processes changes to google OAuth signin status
 * @function userCheck retrieves current userID from data for comparison with retrieved data
 * * @param user the attached userid of gathered cohort/publication data
 * * @param client the attached userid of the current oauth idtoken
 * @function websocketMessageHandler processes incoming websocket messages, alerts View.js id of message recipient matches that stored in user's oauth token
 */

export function fileUploadValidator(file, filetype) {
  const validType = [filetype];
  const errorType = ['No file selected.', 'Too many files selected.', 'File wasn\'t a .png. You uploaded: ' + file.files[0].type, 'File too big. Max upload size is 5mb. Yours was: ' + Math.round((file.files[0].size/0.000001) * 100) / 100];
  // checks number of files uploaded, then checks validity
  if (file.files.length === 0) {
    return errorType[0];
  } else if (file.files.length > 1) {
    return errorType[1];
  } else if (!validType.includes(file.files[0].type)) {
    return errorType[2];
  } else if (file.files[0].size > 5288420) {
    return errorType[3];
  } else {
    return true;
  }
}

export async function authChangeHandler(e) {
  if (e.detail.in === 'in' && e.detail.key !== undefined) {
    const res = await queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    // if user not found, attempt insert of new user into database
    if (res === 201 || res === 404 || res === 500) {
      const res2 = await queryRequest('POST', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
      if (res2 !== 200) {
        window.alert('Login failed, please try again. If problem persists, please contact us with the information on our About page.');
      } else {
        // if user created, build page for user, give them a welcome notification
        window.alert('Thank you for signing up to PeerView!');
        Object.assign(View.skeleton.notif, {id: View.uuidCreate(), type: 'welcome', recipient: await queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token)});
        await View.outgoingNotification();
        View.rebuildCurrentPage();
      }
    } else {
      // if user found, build page for user
      // stops load events firing twice on app refresh if logged in
      if (View.sessionStorage.getItem('page') !== 'feed') {
        View.rebuildCurrentPage();
        return;
      }
      View.closeSidebars();
      View.sidebarSetup();
    }
  }
  if (e.detail.in === 'out') {
    // if client not found, build page for guest
    // hide all auth-necessitated elements
    el.auth.forEach(node => {
      node.style.display = 'none';
    });
    View.rebuildCurrentPage();
  }
}

export async function userTypeCheck(user, client) {
  // set query to get clientID
  const options = setFetchConfig('GET', client);
  const data = await fetch('login', options);
  if (data.status !== 200) { throw data.status };
  const check = await data.json();
  // check if it matches userid attached to publication/citation/userpage
  if (check[0].userid === user) { return true; }
  return false;
}

export async function websocketMessageHandler(e) {
  const message = JSON.parse(e.data);
  // checks for logged in status
  if (window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token !== undefined) {
    // if logged in, check idtoken against websocket recipient id 
    const id = await userTypeCheck(message.recipient, window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    if (id === true) {
      // if client id matches the recipient id, get notification data and send to handler function
      const queryString = `notif/${message.id}&${0}`;
      const notif = await queryRequest('GET', queryString, window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
      console.dir(notif);
      if (notif !== 201 || notif !== 404) {
        View.incomingNotification(notif);
      }
    }
  } 
}

/** Functions below this comment block concern linking view.js to the http routes
 * @function setFetchConfig configures fetch headers for ease of use, dependent on parameters and request type. Saves repetition of lines in later functions
 * * @param ref matches params for queryRequest
 * @function queryRequest condensed query to handle all HTTP query requests
 * * @param type string containing the type of request: GET, PUT, POST, DELETE
 * * @param queryString prewritten and parametised query string
 * * @param client oauth idtoken of current user if applicable 
 * * @param {object} payload contains all information for insert, update and delete requests if applicable
 * * @param form true if payload is FormData, meaning it can't be sent as json
 */

function setFetchConfig(type, client, payload, form) {
  let config;
  client = (typeof client !== 'undefined') ? client : undefined;
  payload = (typeof payload !== 'undefined') ? payload : undefined;
  // if user logged in, request type GET/DELETE
  if (client !== undefined && (type === 'GET' || type === 'DELETE')) {
    config = {
      method: type,
      headers: {
        credentials: 'same-origin',
        'Authorization': 'Bearer ' + client,
      },
    };
  // if guest user, request type GET/DELETE
  } else if (client === undefined && (type === 'GET' || type === 'DELETE')) {
    config = {
      method: type,
    };
  // if client needed, request not GET/DELETE, payload is FormData
  } else if (client !== undefined && (type !== 'GET' || type !== 'DELETE') && payload !== undefined && form === true) {
    config = {
      method: type,
      headers: {
        credentials: 'same-origin',
        'Authorization': 'Bearer ' + client,
      },
      body: payload,
    };
  // if client needed, request not GET/DELETE, payload, not FormData
  } else if (client !== undefined && (type !== 'GET' || type !== 'DELETE') && payload !== undefined && form !== true) {
    config = {
      method: type,
      headers: {
        credentials: 'same-origin',
        'Authorization': 'Bearer ' + client,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };
  // if client not needed, request not GET/DELETE, payload
  } else if (client === undefined && (type !== 'GET' || type !== 'DELETE') && payload !== undefined) {
    config = {
      method: type,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };
  // if client needed, request not GET/DELETE, no payload
  } else if (client !== undefined && (type !== 'GET' || type !== 'DELETE') && payload === undefined) {
    config = {
      method: type,
      headers: {
        credentials: 'same-origin',
        'Authorization': 'Bearer ' + client,
        'Content-Type': 'application/json',
      },
    };
  }
  return config;
}

// all http requests!! in two functions!! pretty pleased with this
export async function queryRequest(queryType, queryString, client, payload, form) {
  // configures client and payload to accomodate needs of different inputs and functions
  // if client is an object, it is supposed to be the payload; assign as such
  // checks if payload is blank; if so, avoid request config including it. otherwise, properly set up other variables for searching
  if (typeof client === 'object') {
    payload = client;
    client = undefined;
  } else {
    client = (typeof client !== 'undefined') ? client : undefined;
    payload = (typeof payload !== 'undefined') ? payload : undefined;
  }
  form = (typeof form !== 'undefined') ? form : undefined;
  // configures query requirements
  const options = setFetchConfig(queryType, client, payload, form);
  const data = await fetch(queryString, options);
  console.log(data.status)
  // only returns status of request, error or not, in every case except for successful get, which returns the rows of data instead
  if (queryType === 'GET' && data.status === 200) { return await data.json() };
  return data.status;
}

/** References in this file:
 * 1: websocket code adaped from https://github.com/portsoc/socket-examples
 */