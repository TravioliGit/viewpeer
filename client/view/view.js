// Global variables, imports, configs
import * as Controller from '../controller.js';
import * as Pages from './pages.js';
import { getEl } from '../elements.js';
const ws = new WebSocket('ws://' + window.location.hostname + ':' + window.location.port + '/');

// storage handlers for browser and css variables
export const localStorage = window.localStorage;
export const sessionStorage = window.sessionStorage;
const root = document.documentElement;

// object array to grab every pertinent page element to simplify DOM manipulation
const el = getEl();

/** Notes about HTTP query formatting:
 * @function Controller.queryRequest will be called for nearly every database query
 * * @param queryType exactly one of 'GET', 'POST', 'PUT', 'DELETE'
 * * @param client call window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token to get client
 * @param queryString and @PARAMS are templates for formatting
 */
let queryString;
let payload = {};

/** 
 * @class PARAMS parameters for GET fetch requests, saves creating new objects on every request and helps to satisfy null/not-null constraints in psql queries
 * @class SKELETON parameter for sending websocket messages to the server 
 */
class PARAMS {
  constructor() {
    this.cohort = {
      id: null,
      name: null,
      offset: 0,
    },
    this.cohortUser = {
      user: null,
      cohort: null,
    },
    this.notif = {
      id: null,
      offset: 0,
    },
    this.publish = {
      id: null,
      user: null,
      cohort: null,
      title: null,
      offset: 0,
    },
    this.review = {
      id: null,
      offset: 0,
    },
    this.user = {
      id: null,
      name: null,
      offset: 0,
    };
  }
}
class SKELETON {
  constructor() {
    this.notif = {
      id: null,
      type: null,
      user: null,
      cohort: null,
      publish: null,
      review: null,
      comment: null,
      recipient: null,
    } 
  };
}
export const params = new PARAMS();
export const skeleton = new SKELETON();

/**
   * Functions listed below serve for page setup on loading the application
   * @function initSite sets storage parameters for session start
   * @function navEventListeners adds event listeners to page navigation tools
   * @function sidebarSetup initialises sidebar content based on local storage
   */

async function initSite() {
  // checker to see if light/dark theme not previously set
  if (!localStorage.getItem('theme')) {
    localStorage.setItem('theme', 'light');
    root.setAttribute('theme', 'light');
  } else {
    root.setAttribute('theme', localStorage.getItem('theme'));
  }
  // sets up session storage with default values, initialise event auth and websocket listeners
  sessionStorage.setItem('page', 'feed');
  sessionStorage.setItem('id', '0');
  ws.addEventListener('message', Controller.websocketMessageHandler);
  window.addEventListener('auth', (e) => {
    Controller.authChangeHandler(e);
  });
  setEventListeners();
  sidebarSetup();
  showFeedPage();
}

async function setEventListeners() {
  // handlers for item in top navbar
  el.header.nav.addEventListener('click', navSidebarToggle);
  el.header.notif.addEventListener('click', notifSidebarToggle);
  el.header.search.addEventListener('click', () => {
    sessionStorage.setItem('page', 'search');
    showSearchPage();
  });
  // handlers for items in left sidebar
  el.nav.recent.addEventListener('click', () => {
    sessionStorage.setItem('page', 'feed');
    showFeedPage();
  });
  el.nav.about.addEventListener('click', () => {
    sessionStorage.setItem('page', 'about');
    showAboutPage();
  });
  el.nav.upload.addEventListener('click', () => {
    sessionStorage.setItem('id', '0');
    sessionStorage.setItem('page', 'pubManage');
    showPublicationPage();
  });
  el.nav.pubs.addEventListener('click', async () => {
    // loads client's id for request
    const id = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    sessionStorage.setItem('id', id[0].userid);
    sessionStorage.setItem('page', 'yourPubList');
    showYourSidebarList();
  });
  el.nav.cohort.addEventListener('click', async () => {
    // loads client's id for request
    const id = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    sessionStorage.setItem('id', id[0].userid);
    sessionStorage.setItem('page', 'yourCohortList');
    showYourSidebarList();
  });
  el.nav.account.addEventListener('click', async () => {
    // loads client's id for request
    const id = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    sessionStorage.setItem('id', id[0].userid);
    sessionStorage.setItem('page', 'userView');
    showUserPage();
  });
  // events for items in right sidebar
  el.notif.refresh.addEventListener('click', async () => {
    params.notif.offset = 0;
    el.notif.offset.textContent = 'Load More';
    await Pages.populateNotifs();
  });
  el.notif.offset.addEventListener('click', async () => {
    params.notif.offset += 20;
    await Pages.populateNotifs();
  });
  // events for items in 'Your Lists' page
  el.your.cohort.addEventListener('click', () => {
    sessionStorage.setItem('id', '0');
    sessionStorage.setItem('page', 'cohortManage');
    showCohortPage();
  });
  el.your.pub.addEventListener('click', () => {
    sessionStorage.setItem('id', '0');
    sessionStorage.setItem('page', 'pubManage');
    showPublicationPage();
  });
  // event for item in 'Error' page
  el.error.button.addEventListener('click', () => {
    rebuildCurrentPage(true);
  });
  el.nav.theme.addEventListener('click', changePageTheme);
}

export async function sidebarSetup() {
  // Tests for pre-existing auth data, populates sidebars accordingly.
  // Adjusts text and Oauth on nav-sidebar, attempts to populate notifications list
  if (window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token === undefined) {
    // if user not logged in
    el.nav.signout.style.display = 'none';
    el.nav.signin.style.display = 'flex';
    el.notif.refresh.style.display = 'none';
    el.notif.offset.style.display = 'none';
    el.notif.list.textContent = 'Sign in to get notifications.';
    el.nav.upload.style.display = 'none';
    el.nav.pubs.style.display = 'none';
    el.nav.cohort.style.display = 'none';
    el.nav.account.style.display = 'none';
  } else {
    // displays logged-in elements in sidebars
    el.nav.signout.style.display = 'flex';
    el.nav.signin.style.display = 'none';
    el.notif.list.textContent = '';
    el.nav.upload.style.display = 'flex';
    el.nav.pubs.style.display = 'flex';
    el.nav.cohort.style.display = 'flex';
    el.nav.account.style.display = 'flex';
    el.notif.refresh.style.display = 'flex';
    el.notif.offset.style.display = 'flex';
    await Pages.populateNotifs();
  }
  // checks pre-existing theme data
  if (localStorage.getItem('theme') === 'light') {
    el.nav.theme.textContent = 'Change to Dark Mode';
  } else {
    el.nav.theme.textContent = 'Change to Light Mode';
  }
}

/** Functions listed below all build pages of the app based on retrieved information
 * @function showFeedPage shows populated list of most recent publications
 * @function showSearchPage shows page where user can search for cohorts, users, publications, etc
 * @function showUserPage shows singular user page. view-only or manageable dependent on app state
 * @function showYourSidebarList shows either 'Your Publication' or 'Your Cohort' list page
 * @function showPublicationPage shows publication page. view-only or manageable dependent on app state
 * @function showCohortPage shows cohort inspect page. view-only or manageable dependent on app state
 * @function showAboutPage shows website information page
 * @function showErrorPage displays page on error loading cohort, publication or user information
 */

export async function showFeedPage() {
  // clear page, show page
  hidePages();
  resetParams();
  closeSidebars();
  el.feed.results.innerHTML = '';
  el.feed.page.style.display = 'block';
  // set up populated list, add event for loading offset results
  const check = await Pages.buildFeedPage();
  if (check === 'done') {
    el.feed.offset.style.display = 'block';
    el.feed.offset.addEventListener('click', async () => {
      params.publish.offset += 20;
      await Pages.buildFeedPage();
    });
  }
}

export async function showSearchPage() {
  // clear page, show page
  hidePages();
  resetParams();
  closeSidebars();
  el.search.results.innerHTML = '';
  el.search.page.style.display = 'block';

  // click events for filter buttons. only one may be selected for filter function; selecting one will deselect all others. 
  // an over-engineered way to do it, but i'm actually quite happy with what i've made here
  const filters = [el.search.cohort, el.search.user, el.search.pub];
  filters.forEach(check => {
    if (!check.classList.contains('click')) {
      check.addEventListener('click', () => {
        check.classList.add('click');
        // reset values to avoid errors in either offsetting or query area, and clear results area
        resetParams();
        el.search.results.innerHTML = '';
        el.search.offset.textContent = 'Load More';
        el.search.offset.style.display = 'none';
        // sets up a reference array for each event
        filters.forEach(mate => {
          // if match reference, check bool to true
          if (check === mate) {
            mate.dataset.filter = 'true';
            mate.style.backgroundColor = 'var(--button-border)'; 
          } else {
            mate.dataset.filter = 'false';
            mate.style.backgroundColor = 'var(--button-colour)'; 
          }
        });
      });
    }
  });

  // on text change in search bar, reset values to avoid errors in either offsetting or query area, and clear results area
  el.search.bar.addEventListener('input', async () => {
    resetParams();
    el.search.results.innerHTML = '';
    el.search.offset.textContent = 'Load More';
    el.search.offset.style.display = 'none';
    el.search.offset.removeEventListener('click', await offsets, true);
  });

  // event handler for offset loading; removes event handler if changing search parameters
  async function offsets() {
    if (el.search.cohort.dataset.filter === 'true') {
      params.cohort.offset += 20;
    } else if (el.search.user.dataset.filter === 'true') {
      params.user.offset += 20;
    } else if (el.search.pub.dataset.filter === 'true') {
      params.publish.offset += 20;
    }
    await Pages.populateSearchResults();
  }

  // on search, check which (if any) filter is applied and call search function
  async function search() {
    // checks if bar has a value; if not, don't perform search
    if (el.search.bar.value === '') {
      el.search.bar.placeholder = 'Search bar was empty!';
      return;
    }
    // modifies parameters based on given information
    if (el.search.cohort.dataset.filter === 'true') {
      Object.assign(params, { cohort: {...params.cohort, name: el.search.bar.value }, user: {...params.user, name: null}, publish: {...params.publish, title: null} } );
    } else if (el.search.user.dataset.filter === 'true') {
      Object.assign(params, { cohort: {...params.cohort, name: null }, user: {...params.user, name: el.search.bar.value}, publish: {...params.publish, title: null} } );
    } else {
      // default case, will search for publication name
      Object.assign(params, { cohort: {...params.cohort, name: null }, user: {...params.user, name: null}, publish: {...params.publish, title: el.search.bar.value} } );
    }
    // show offset loading button
    const check = await Pages.populateSearchResults();
    if (check === 'done') {
      el.search.offset.style.display = 'block';
      // handle offset loading. values reset on any change to filter/search terms
      el.search.offset.addEventListener('click', await offsets, true);
    }
    // re-enable event handler for a small time to disable spamming queries during load
    setTimeout(() => {
      el.search.go.addEventListener('click', search, { once: true });
    }, 750);
  }
  el.search.go.addEventListener('click', search, { once: true });
}

export async function showUserPage() {
  // clear page values, hide auth elements, set search parameters, show page
  hidePages();
  resetParams();
  closeSidebars();
  el.userInspect.page.style.display = 'block';

  Object.assign(params, { user: {...params.user, id: sessionStorage.getItem('id')}, cohortUser: {...params.cohortUser, user: sessionStorage.getItem('id')}, publish: {...params.publish, user: sessionStorage.getItem('id')} } );
  // tests if user is loading their own page, is an external user, or is guest user, so page can adjust elements accordingly
  if (window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token === undefined) {
    await Pages.buildUserViewPage('guestuser');
  } else {
    const check = await Controller.userTypeCheck(sessionStorage.getItem('id'), window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    if (check === true) {
      await Pages.buildUserViewPage('sameuser');
    } else {
      await Pages.buildUserViewPage('notsameuser');
    }
  }
}

export async function showYourSidebarList() {
  // clear other pages and page values, show current page
  hidePages();
  resetParams();
  closeSidebars();
  el.your.page.style.display = 'block';
  el.your.list.innerHTML = '';
  if (sessionStorage.getItem('page') === 'yourPubList') {
    document.querySelector('#your-header').textContent = 'Your Publications';
  } else {
    document.querySelector('#your-header').textContent = 'Your Cohorts';
  }
  Object.assign(params, { user: {...params.user, id: sessionStorage.getItem('id')}, cohortUser: {...params.cohortUser, user: sessionStorage.getItem('id')}, publish: {...params.publish, user: sessionStorage.getItem('id')} } );
  Pages.buildYourSidebarList(sessionStorage.getItem('page'));
}

export async function showPublicationPage() {
  // clear other pages and page values, show current page
  hidePages();
  resetParams();
  closeSidebars();  
  el.pubInspect.page.style.display = 'block';
  Object.assign(params, { publish: {...params.publish, id: sessionStorage.getItem('id')}, review: {...params.review, id: sessionStorage.getItem('id')} } );
  // test if user is uploading a new publication to ready a blank page. otherwise, load view-only as normal
  if (sessionStorage.getItem('id') === '0') {
    Pages.buildPublicationManagePage();
  } else {
    Pages.buildPublicationViewPage();
  }
}

export async function showCohortPage() {
  // clear other pages and page values, show current page
  hidePages();
  resetParams();
  closeSidebars();
  el.cohortInspect.page.style.display = 'block';
  Object.assign(params, { cohort: {...params.cohort, id: sessionStorage.getItem('id')}, cohortUser: {...params.cohortUser, cohort: sessionStorage.getItem('id')}, publish: {...params.publish, cohort: sessionStorage.getItem('id')} } );
  // test if user is creating a new cohort to ready a blank page. otherwise, load view-only as normal
  if (sessionStorage.getItem('id') === '0') {
    Pages.buildCohortManagePage();
  } else {
    Pages.buildCohortViewPage();
  }
}

function showAboutPage() {
  // clear pages, show page
  hidePages();
  resetParams();
  closeSidebars();
  el.about.page.style.display = 'block';
}

export function showErrorPage(error) {
  // clear pages, show page
  hidePages();
  resetParams();
  closeSidebars();
  el.error.page.style.display = 'block';
  console.log(error);
}

/** Functions listed below serve for ancillary page manipulation
 * @function navSidebarToggle toggles display of the left sidebar
 * @function notifSidebarToggle toggles display of the right sidebar
 * @function closeSidebars hides both sidebars on when needed
 * @function addListener shorthand function for adding classList-based event listeners
 * * @params type, elem, function and check
 * @function outgoingNotification handles event for sending notifications to database and websocket server
 * @function incomingNotification handles event for incoming user notifications
 * @function hidePages hides all class=page elements
 * @function resetParams resets parameters to default state, except notification offsets 
 * @function resetSkeleton resets skeleton for websocket requests, called whenever a socket message is sent
 * @function uuidCreate generates a uuidv4 for usage in websocket messages
 * @function changePageTheme used to change global colours of page elements
 * @function rebuildCurrentPage used to reload page elements based on current page. fires on auth status change and after page data submission
 * * @param ignore if true, tells function to ignore reloading notif sidebar in case auth not changed
 */

function navSidebarToggle() {
  // hides notif sidebar if shown to avoid page layout confusion
  if (el.notif.bar.style.display === 'block') {
    el.notif.bar.style.display = 'none';
  }
  // hides sidebar if shown 
  if (el.nav.bar.style.display === 'block') {
    el.nav.bar.style.display = 'none';
  } else {
    el.nav.bar.style.display = 'block';
  }
}

function notifSidebarToggle() {
  // hides nav sidebar if shown to avoid page layout confusion
  if (el.nav.bar.style.display === 'block') {
    el.nav.bar.style.display = 'none';
  }
  // hides sidebar if shown 
  if (el.notif.bar.style.display === 'block') {
    el.notif.bar.style.display = 'none';
  } else {
    el.notif.bar.style.display = 'block';
  }
}

export function closeSidebars() {
  el.nav.bar.style.display = 'none';
  el.notif.bar.style.display = 'none';
}

// refactor event listeners using this if you get the time
export async function addListener(type, elem, func, check) {
  if (elem.classList.contains(type)) {
    elem.classList.add(type);
    // adds async functionality if needed
    if (check) { elem.addEventListener(type, await func) }
    else { elem.addEventListener(type, func) }
  }
}

export async function outgoingNotification() {
  let check = await Controller.queryRequest('POST', 'notif', skeleton.notif);
  if (check === 200) {
    ws.send(JSON.stringify(skeleton.notif));
    resetSkeleton();
    return true;
  } else {
    return false;
  }
}

export async function incomingNotification(message) {
  // change colour of bell to red
  await Pages.populateNotifs(message);
}

export function hidePages() {
  // clears all lingering id datasets for security reasons
  const ids = document.querySelectorAll('[data-id]');
  [...ids].forEach(item => {
    // except for ones in notification bar, which persists through pages
    if (item.classList.contains('notif-wrapper')) {  }
    else { item.removeAttribute('data-id'); }
  });
  // hides all .auth elements except the notif sidebar ones
  el.auth.forEach(item => {
    item.style.display = 'none';
  });
  // hides page backgrounds
  const pages = document.querySelectorAll('.page');
  [...pages].forEach(item => {
    item.style.display = 'none';
  });
}

function changePageTheme() {
  // get current theme; change storage and root variable
  const currentTheme = localStorage.getItem('theme');
  if (currentTheme === 'light') {
    localStorage.setItem('theme', 'dark');
    root.setAttribute('theme', 'dark');
    el.nav.theme.textContent = 'Change to Light Mode';
  } else {
    localStorage.setItem('theme', 'light');
    root.setAttribute('theme', 'light');
    el.nav.theme.textContent = 'Change to Dark Mode';
  }
}

export function resetParams() {
  // nested objects require two loops
  Object.keys(params).forEach(key => {
    Object.keys(params[key]).forEach(param => {
      // loop avoids the notif bar since it is independent from other page elements and its values are managed elsewhere
      if (param !== 'offset') {
        params[key][param] = null;
      } else {
        if (key !== 'notif') {
          params[key][param] = 0;
        }
      }
    });
  });
}

export function resetSkeleton() {
  // loop through only object, set all values to null
  Object.keys(skeleton.notif).forEach(key => {
    skeleton.notif[key] = null;
  });
}

export function uuidCreate(){
  let dt = new Date().getTime();
  let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (dt + Math.random()*16)%16 | 0;
      dt = Math.floor(dt/16);
      return (c=='x' ? r :(r&0x3|0x8)).toString(16);
  });
  return uuid;
}

export function rebuildCurrentPage(ignore) {
  closeSidebars();
  if (ignore !== true) {
    sidebarSetup();
  }
  // gets current page held in storage
  const currentPage = sessionStorage.getItem('page');
  switch (currentPage) {
    case 'feed':
      showFeedPage();
      break;
    case 'search':
      showSearchPage();
      break;
    case 'about':
      showAboutPage();
      break;
    case 'userView':
      showUserPage();
      break;
    case 'userManage':
      // impossible to re-auth back into page, so defaults to read-only
      showUserPage();
      break;
    case 'cohortView':
      showCohortPage();
      break;
    case 'cohortManage':
      // impossible to re-auth back into page, so defaults to read-only
      showCohortPage();
      break;
    case 'pubView':
      showPublicationPage();
      break;
    case 'pubManage':
      // impossible to re-auth back into page, so defaults to read-only
      showPublicationPage();
      break;
    case 'yourCohortList':
      showYourSidebarList();
      break;
    case 'yourPubList':
      showYourSidebarList();
      break;
    default:
      window.alert('Page not found! Returning to recent feed.');
      showFeedPage();
      break;
  }
}

window.addEventListener('load', initSite);

/** References in this file:
 * 1: recursivly updating a nested object, in @function resetParams, adapted from https://dev.to/nitinreddy3/recursion-to-update-deeply-nested-objects-f7e
 * 2: all websocket-related code adapted from https://github.com/portsoc/socket-examples and https://github.com/portsoc/EventedWebSocketMouse and https://github.com/portsoc/socket-examples
 * 3: uuid generating code adapted from https://www.w3resource.com/javascript-exercises/javascript-math-exercise-23.php
 * * @note the uuid node package didn't work because importing it was too tricky
 * 4: object spreading information and help from https://stackoverflow.com/questions/43436727/multiple-object-properties-assignment
 */