// Global variables, imports, configs
import * as Controller from '../controller.js';
import { getEl } from '../elements.js';
import * as View from './view.js'
const ws = new WebSocket('ws://' + window.location.hostname + ':' + window.location.port + '/');

// object array to grab every pertinent page element to simplify DOM manipulation
const el = getEl();

/** Notes about HTTP query formatting:
 * @function Controller.queryRequest will be called for nearly every database query
 * * @param queryType exactly one of 'GET', 'POST', 'PUT', 'DELETE'
 * * @param client call window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token to get client
 * @param queryString and @params are templates for formatting
 */
let queryString;
let payload = {};

/** Functions listed below all build pages of the app based on retrieved information
 * @function buildFeedPage loads populated list of most recent publications
 * @function populateNotifs refreshes notif list on websocket receive, offset load and app load
 * * @param message not undefined if notification comes from websocket, and applies to start of list
 * @function populateSearchResults sets up and displays search results based on user input
 * @function buildUserViewPage loads  view-only singular user page
 * * @param auth variable dependent on if user inspecting own page (used to show 'Edit User' or 'Invite to Cohort' button)
 * @function buildUserEditPage loads and sets up page to edit user information. only loads on successful auth
 * * @param data all user data from the view-only page
 * @function buildYourSidebarList loads either 'Your Publication' or 'Your Cohort' list page
 * * @param page string denoting the page desired by the user, either yourPubView or yourCohortView
 * @function buildPublicationViewPage loads view-only publication page
 * @function buildPublicationManagePage loads editable publication page
 * @function buildCohortViewPage loads view-only cohort inspect page
 * @function buildCohortManagePage loads editable cohort inspect page
 */

export async function buildFeedPage() {
  // gathers data from server
  queryString = `publish/${View.params.publish.id}&${View.params.publish.user}&${View.params.publish.cohort}&${View.params.publish.title}&${View.params.publish.offset}`;
  const data = await Controller.queryRequest('GET', queryString);
  if (data !== 201 && data !== 404) {
    populateFeedTemplate(data, el.feed.results)
    return 'done';
  // handlers for errors; successive loads will fail at some point, but is not a total error
  } else if (data === 201) {
    el.feed.offset.textContent = 'No older publications found.';
    return 'full';
  } else {
    el.feed.page.textContent = 'Error loading publications, please try again or contact the developer.';
    return 'error';
  }
}

export async function populateNotifs(message) {
  let data, alert, obj;
  message = (typeof message !== 'undefined') ? message : undefined;
  // tests if request comes from loading list or a new notification, adjusts accordingly 
  if (message !== undefined) {
    data = message;
    alert = true;
  } else {
    queryString = `notif/${View.params.notif.id}&${View.params.notif.offset}`;
    data = await Controller.queryRequest('GET', queryString, window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
  }

  // request for notification data on successful authentication
  if (data === 201 && View.params.notif.offset !== 0) {
    // request success, nothing found, offset
    el.notif.offset.textContent = 'No older notifications';
    return 'full';
  } else if (data === 201 && View.params.notif.offset === 0) {
    // request success, nothing found, no offset
    el.notif.list.textContent = 'No notifications found. You\'re on top of your inbox!';
    return 'empty';
  } else if (data === 404) {
    // request error
    el.notif.list.textContent = 'Error loading your notifications, please try again later or contact the administrator.';
    return 'error';
  }
  // request success: checks offset value to judge whether it's a refresh (from 0) or an offset load (from 20+)
  if (View.params.notif.offset === 0 && message === undefined) {
    // clears list if refresh
    el.notif.list.innerHTML = '';
  }
  data.forEach(function (notif) {
    // list populated using templates and gathered data
    const template = el.templates.notif.content.cloneNode(true);
    const row = template.querySelector('.notif-wrapper');
    // checker that i wrote in after the fact so that incoming notifications populate properly
    if (alert === true) {
      obj = data[0].json_build_object;
    } else {
      obj = notif.json_build_object;
    }
    row.id = obj.id;
    // populate list item with content dependent on notification type
    // see 'notif-template' in index.html for template structre
    switch (obj.type) {
      // sets up notification for type invite. allows for accepting and refusing of notification.
      case 'invite':
        row.value1 = obj.cohort;
        row.value2 = obj.recipient;
        elementHider('invite');
        row.children[1].textContent = 'Invitation to Cohort!'
        row.children[2].textContent = `You have been invited to join ${obj.cohortname}! Do you accept?`
        row.children[3].children[0].addEventListener('click', async () => {
          // event handler for accepting invite; setup query and send
          queryString = `cohortuser`;
          payload = {
            cohort: row.value,
            user: row.value2,
          };
          const res = await Controller.addUserToCohort('POST', queryString, payload);
          if (res === 200) {
            window.alert(`Joined new cohort!`);
            View.sessionStorage.setItem('page', 'cohortView');
            View.sessionStorage.setItem('id', row.value1);
            View.showPublicationPage();
            deleteNotif(row.id);

          } else {
            elementHider('error');
            row.children[1].textContent = 'Error joining cohort'
            row.children[2].textContent = `Refresh and try again. If problem persists, contact the administrator.`
          }
        });
        break;
      // sets up notification for type review. can be deleted or followed to relevent publication.
      case 'review':
        row.value1 = obj.pub;
        elementHider('review');
        // click event to navigate to publication page
        row.addEventListener('click', (e) => {
          View.sessionStorage.setItem('page', 'pubView');
          View.sessionStorage.setItem('id', row.value1);
          View.showPublicationPage();
        });
        row.children[1].textContent = `New Review from ${obj.username}! Tap me to see!`;
        row.children[2].textContent = `They reviewed: ${obj.pubtitle.substring(0, 30)}...`;
        break;
      // sets up notifcation for type comment. can be deleted or followed to relevent publication.
      case 'comment':
        row.value1 = obj.pub;
        elementHider('comment');
        // click event to navigate to publication page
        row.addEventListener('click', () => {
          View.sessionStorage.setItem('page', 'pubView');
          View.sessionStorage.setItem('id', row.value1);
          View.showPublicationPage();
        });
        row.children[1].textContent = `New Comment from ${obj.username}! Tap me to see!`;
        row.children[2].textContent = `They replied to your review of: ${obj.pubtitle.substring(0, 30)}...`;
        break;
      // setup notification for welcoming new users.
      case 'welcome':
        elementHider('welcome');
        row.children[1].textContent = 'Welcome to PeerView!';
        row.children[2].textContent = 'As you interact with the app, any notifications you receive will appear in this list.';
        break;
    }

    // if 'X' element shown, add event listener
    if (row.children[0].style.display !== 'none') {
      row.children[0].addEventListener('click', async () => {
        queryString = `notif/${row.id}`
        const res = await Controller.queryRequest('DELETE', queryString);
        if (res === 200) {
          row.remove();
        } else {
          elementHider('error');
          row.children[1].textContent = 'Error deleting notification.';
          row.children[2].textContent = 'Try again. If problem persists, contact the administrator.';
        }
      });
    }
    // helper function to hide elements based on notification type to avoid wayward click events
    function elementHider(param) {
      if (param === 'error') {
        row.children[0].style.display = 'none';
        row.children[3].children[0].style.display = 'none';
        row.children[3].children[1].style.display = 'none';
      } else if (param === 'invite') {
        row.children[0].style.display = 'none';
      } else {
        row.children[3].children[0].style.display = 'none';
        row.children[3].children[1].style.display = 'none';
      }
    }
    // append to list. if new notif append to top, otherwise append to bottom
    if (message !== undefined) {
      el.notif.list.prepend(row)
    } else {
      el.notif.list.appendChild(row);
    }
  });
}

export async function populateSearchResults() {
  // config query request based on filter and request data
  if (View.params.cohort.name !== null) {
    queryString = `cohort/${View.params.cohort.id}&${View.params.cohort.name}&${View.params.cohort.offset}`;
  } else if (View.params.user.name !== null) {
    queryString = `user/${View.params.user.id}&${View.params.user.name}&${View.params.user.offset}`;
  } else {
    queryString = `publish/${View.params.publish.id}&${View.params.publish.user}&${View.params.publish.cohort}&${View.params.publish.title}&${View.params.publish.offset}`;
  }
  const data = await Controller.queryRequest('GET', queryString);
  // error handler statement for search queries
  if (data === 201 && (View.params.cohort.offset !== 0 || View.params.user.offset !== 0 || View.params.publish.offset !== 0)) {
    // request success, nothing found, any offset
    el.search.offset.textContent = 'No further results';
    return 'full';
  } else if (data === 201 && (View.params.cohort.offset === 0 && View.params.user.offset === 0 && View.params.publish.offset === 0)) {
    // request success, nothing found, no offsets
    el.search.results.textContent = 'No results found. Try a different filter, or less specific search terms.';
    return 'empty';
  } else if (data === 404) {
    // request error
    el.search.results.textContent = 'Error loading search results, please try again later or contact the administrator if the issue persists.';
    return 'error';
  }
  // if ok, loop through data and populate page. if publication search, use feed template
  if (View.params.publish.title !== null) {
    populateFeedTemplate(data, el.search.results);
  } else {
    // if cohort or user search, use results template
    populateResultTemplate(data, el.search.results);
  }
  return 'done';
}

export async function buildUserViewPage(auth) {
  // requests user data, errors out if appropriate
  queryString = `user/${View.params.user.id}&${View.params.user.name}&${View.params.user.offset}`;
  const data = await Controller.queryRequest('GET', queryString);
  if (data === 404 || data === 201) {
    View.showErrorPage(data);
    return;
  }
  // gets response data into more readable state
  const info = data[0].json_build_object;
  // populate page
  el.userInspect.page.dataset.id = info.id;
  el.userInspect.disp.textContent = info.dispname ? info.dispname : 'No username provided';
  if (info.fname === null && info.lname !== null) { el.userInspect.name.textContent = info.fname;
  } else if (info.fname !== null && info.lname === null) { el.userInspect.name.textContent = info.lname;
  } else if (info.fname !== null && info.lname !== null) { el.userInspect.name.textContent = info.fname + ' ' + info.lname;
  } else { el.userInspect.name.textContent = 'No name provided';
  }
  el.userInspect.email.textContent = info.email ? info.email : 'No email provided';
  el.userInspect.about.textContent = info.about ? info.about : 'No extra information provided';
  el.userInspect.avatar.src = info.avatar;
  
  // populate list of publication titles and cohort names, if either are applicable
  el.userInspect.pubs.innerHTML = '';

  queryString = `publish/${View.params.publish.id}&${View.params.publish.user}&${View.params.publish.cohort}&${View.params.publish.title}&${View.params.publish.offset}`;
  const pubs = await Controller.queryRequest('GET', queryString);
  if (pubs === 201) {
    el.userInspect.pubs.textContent = 'This user has not uploaded any publications.';
  } else if (pubs === 404) {
    el.userInspect.pubs.textContent = 'Error loading publications.';
  } else {
    populateListTemplate(pubs, el.userInspect.pubs);
  }

  queryString = `cohortuser/${View.params.cohortUser.user}&${View.params.cohortUser.cohort}`;
  el.userInspect.cohorts.innerHTML = '';
  const cohorts = await Controller.queryRequest('GET', queryString);
  if (cohorts === 201) {
    el.userInspect.cohorts.textContent = 'This user has not joined any cohorts.';
  } else if (cohorts === 404) {
    el.userInspect.cohorts.textContent = 'Error loading cohorts.';
  } else {
    populateListTemplate(cohorts, el.userInspect.cohorts);
  }

  // add elements based on user status: if page belongs to current user, show edit button. if user but not page owner, show 'invite to cohort options'
  if (auth === 'sameuser') {
    el.userInspect.edit.style.display = 'flex';
    if (!el.userInspect.edit.classList.contains('click')) {
      el.userInspect.edit.classList.add('click');
      el.userInspect.edit.addEventListener('click', () => {
        sessionStorage.setItem('page', 'userManage');
        buildUserManagePage(info);
      });
    }    
  } else if (auth === 'notsameuser') {
    // check if current user has any linked cohorts
    let id = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    const check = await Controller.queryRequest('GET', `cohortuser/${id[0].userid}&${View.params.cohortUser.cohort}`);
    if (check !== 201 && check !== 404) {
      // if cohorts, populate drop down list with data
      el.userInspect.inviteList.style.display = 'flex';
      el.userInspect.inviteSubmit.style.display = 'flex';

      // if existing data in list, clears list except for placeholder value
      for (let i = el.userInspect.inviteList.options.length - 1; i >= 1; i--) {
        el.userInspect.inviteList.remove(i);
      }
      check.forEach(item => {
        const obj = item.json_build_object;
        let child = document.createElement('option');
        child.value = obj.id;
        child.textContent = obj.name;
        el.userInspect.inviteList.appendChild(child);
      });
      // if user has valid value, send notification to websocket server and insert notification into database
      if (!el.userInspect.inviteSubmit.classList.contains('click')) {
        el.userInspect.inviteList.classList.add('click');
        el.userInspect.inviteSubmit.addEventListener('click', async () => {
          if (el.userInspect.inviteList.value === 'null') {
            window.alert('You didn\'t choose a cohort!');
            return;
          }
          // send notification to database; on success, send notif to websocket server
          Object.assign(View.skeleton.notif, {id: View.uuidCreate(), type: 'invite', user: id[0].id, cohort: el.userInspect.inviteList.value, recipient: el.userInspect.page.pageId});
          let check = await View.outgoingNotification();
          if (check === true) {
            window.alert('Invite sent!');
          } else {
            window.alert('Error sending invitation. If error persists, contact the administrator.');
          }
        });  
      }
    }
  }
}

export async function buildUserManagePage(data) {
  // clear page values, set parameters, show page
  View.hidePages();
  View.resetParams();
  View.closeSidebars();
  el.userManage.page.style.display = 'block';
  let img = null;
  console.log(data);

  // populate page with data if given. null values default to placeholder. page resubmits all data on save for database consistency
  el.userManage.page.dataset.id = data.id;
  el.userManage.avatar.src = data.avatar;
  // acts as a pocket value in case user uploads new avatar
  el.userManage.avatarUpload.dataset.exist = data.avatar;
  el.userManage.disp.value = data.dispname ? data.dispname : null;
  el.userManage.fname.value = data.fname ? data.fname : null;
  el.userManage.lname.value = data.lname ? data.lname : null;
  el.userManage.email.value = data.email ? data.email : null;
  el.userManage.about.value = data.about ? data.about : null;

  // event handler for hidden button element
  if (!el.userManage.avatarButton.classList.contains('click')) {
    el.userManage.avatarButton.classList.add('click');
    el.userManage.avatarButton.addEventListener('click', async () => {
      el.userManage.avatarUpload.click();
    });
  }

  // event handler for image file upload
  if (!el.userManage.avatarUpload.classList.contains('input')) {
    el.userManage.avatarUpload.classList.add('input');
    el.userManage.avatarUpload.addEventListener('input', () => {
      // tests validity of file to avoid databasing errors
      const validityCheck = Controller.fileUploadValidator(el.userManage.avatarUpload, 'image/png');
      if (validityCheck !== true) {
        window.alert('Invalid image. Reason: ' + validityCheck);
        return;
      }
      // displays image on page, but saves usable image path for insertion into database
      el.userManage.avatarButton.textContent = el.userManage.avatarUpload.files[0].name;
      el.userManage.avatar.src = URL.createObjectURL(el.userManage.avatarUpload.files[0])
      img = el.userManage.avatarUpload.files[0];
    });
  }

  // handler to submit form data
  if (!el.userManage.submit.classList.contains('click')) {
    el.userManage.submit.classList.add('click');
    el.userManage.submit.addEventListener('click', async () => {
      // arrays to loop through for form data population
      const elements = [el.userManage.disp.value, el.userManage.fname.value, el.userManage.lname.value, el.userManage.email.value, el.userManage.about.value];
      const formFields = ['display', 'fname', 'lname', 'email', 'about'];
      let form;
      // if new image, populate FormData and send to database. if not new image, send as json object
      if (img !== null) {
        form = new FormData();
        form.append('avatar', img);
        // loop to tidily populate form data with text values. inserts null if values are empty
        for (let i=0; i<=4; i++) {
          if (elements[i] !== '') {
            form.append(formFields[i], elements[i]);
          } else {
            form.append(formFields[i], null);
          }
        }
      } else {
        // if pre-existing/placeholder image, append path to json object
        form = {
          display: el.userManage.disp.value,
          fname: el.userManage.fname.value,
          lname: el.userManage.lname.value,
          email: el.userManage.email.value,
          avatar: el.userManage.avatarUpload.dataset.exist,
          about: el.userManage.about.value,
        };
      } 
      
      // send request; append formdata checker if applicable
      let check;
      if (img !== null) { check = await Controller.queryRequest('PUT', 'user', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, form, true) }
      else { check = await Controller.queryRequest('PUT', 'user', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, form); }
      if (check === 200) {
        window.alert('Data saved!');
        // on success, clear existing values load view-only version of user page
        el.userManage.avatarUpload.dataset.exist = null;
        View.rebuildCurrentPage(true);
        return;
      }
      else if (check === 500) {
        window.alert('There was a problem sending your fancy new avatar to the database. If it doesn\t work after a refresh, contact the administrator.');
      } else {
        window.alert('There was a problem saving your data. If problem persists after a refresh, contact the administrator.');
      }
    });
  }

  // handler for user deleting account information
  if (!el.userManage.delete.classList.contains('click')) {
    el.userManage.delete.classList.add('click');
    el.userManage.delete.addEventListener('click', async () => {
      if (window.confirm('Are you sure you want to delete your profile? You can always sign up another time.') === true) {
        const check = await Controller.queryRequest('DELETE', 'user', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
        if (check === 200) {
          window.alert('Sorry to see you go. Thank you for using the app!'); 
          const auth2 = window.gapi.auth2.getAuthInstance();
          auth2.signOut().then(function () {
            auth2.disconnect();
            const authOutEvent = new CustomEvent('auth', { detail: { in: 'out' } });
            dispatchEvent(authOutEvent);
          });
        } else {
          window.alert('Error deleting your information. We swear we\'re not messing around! Refresh and try again. If it\'s still not working, please get in touch with the developer.');
        }
      }
    });
  }
}

export async function buildYourSidebarList(page) {
  // set up query based on page type
  if (page === 'yourPubList') {
    queryString = `publish/${View.params.publish.id}&${View.params.publish.user}&${View.params.publish.cohort}&${View.params.publish.title}&${View.params.publish.offset}`;
    el.your.cohort.style.display = 'none';
    el.your.pub.style.display = 'block';
  } else {
    queryString = `cohortuser/${View.params.cohortUser.user}&${View.params.cohortUser.cohort}`;
    el.your.cohort.style.display = 'block';
    el.your.pub.style.display = 'none';
  }
  const data = await Controller.queryRequest('GET', queryString);
  // error handler statement for search queries
  if (data === 201) {
    // request success, nothing found, no offsets
    if (page === 'yourPubList') {
      el.your.list.textContent = 'It looks like you haven\'t uploaded any papers yet. As you upload papers for people to see, you\'ll find them in this list.';
    } else {
      el.your.list.textContent = 'It looks like you haven\' joined any cohorts yet. As you join cohorts, they\'ll show up in this list for you to see.'
    }
    return 'empty';
  } else if (data === 404) {
    // request error
    el.your.list.textContent = 'Error loading results, please try again later or contact the administrator if the issue persists.';
    return 'error';
  }
  
  // if ok, loop through data and populate list. if publication list, use feed template
  if (page === 'yourPubList') {
    populateFeedTemplate(data, el.your.list);
  } else {
    // if cohort list, use results template
    populateResultTemplate(data, el.your.list);
  }
}

export async function buildPublicationViewPage() {
  queryString = `publish/${View.params.publish.id}&${View.params.publish.user}&${View.params.publish.cohort}&${View.params.publish.title}&${View.params.publish.offset}`;
  const data = await Controller.queryRequest('GET', queryString);
  if (data === 404 || data === 201) {
    View.showErrorPage(data);
    return;
  } 
  // gets response data into more readable state
  const info = data[0].json_build_object;
  // populate page with static data
  el.pubInspect.page.dataset.id = info.id;
  el.pubInspect.title.textContent = info.title;
  el.pubInspect.disp.textContent = 'Publication Author: ' + info.dispname + '. Click here to view';;
  el.pubInspect.disp.dataset.id = info.userid;

  if (info.link !== null) {
    el.pubInspect.download.textContent = 'Click for External Link to Publication';
    el.pubInspect.download.href = info.link;
  } else {
    el.pubInspect.download.textContent = 'Click to View Publication';
    el.pubInspect.download.href = info.path;
  }
  if (info.cohortname !== null) {
    el.pubInspect.cohort.textContent = 'Publication\'s Cohort: ' + info.cohortname + '. Click here to view';
    el.pubInspect.cohort.dataset.id = info.cohortid;
  } else {
    el.pubInspect.cohort.innerHTML = '';
    el.pubInspect.cohort.dataset.id = '';
  }
  el.pubInspect.area.textContent = info.areaname ? 'Academic Area: ' + info.areaname : 'No listed academic area';
  el.pubInspect.abstract.textContent = info.abstract ? 'About this paper: ' + info.abstract : null;
  
  // listener events for username, cohortname
  if (!el.pubInspect.cohort.classList.contains('click')) {
    el.pubInspect.cohort.classList.add('click');
    el.pubInspect.cohort.addEventListener('click', () => { 
      View.sessionStorage.setItem('page', 'cohortInspect');
      View.sessionStorage.setItem('id', el.pubInspect.cohort.dataset.id);
      View.showCohortPage();
    });
  }

  if (!el.pubInspect.disp.classList.contains('click')) {
    el.pubInspect.disp.classList.add('click');
    el.pubInspect.disp.addEventListener('click', () => { 
      View.sessionStorage.setItem('page', 'userInspect');
      View.sessionStorage.setItem('id', el.pubInspect.disp.dataset.id);
      View.showUserPage();
    });
  }

  // grab all /5 reviews for publication to calculate and display average
  const of5 = await Controller.queryRequest('GET', `rating/${info.id}`);
  if (of5 !== 201 && of5 !== 404) {
    let avg, count = 0, total = 0;
    of5.forEach(loop => {
      const item = loop.json_build_object;
      total += item.of5;
      count++;
    });
    // calculate average. pretty snazzy ey?
    avg = total / count;
    let star = el.pubInspect.of5.innerHTML.slice(2);
    // check if this string keeps duping 5s, since not doing this caused many 5s to load over time 
    if (star.substring(0, 1) !== '5') {
    el.pubInspect.of5.innerHTML = `${Math.round(avg*100)/100}/5${star}`;
    } else {  }
  } else {
    el.pubInspect.of5.innerHTML = 'Failed to calculate review average. Reviews too high, or too low? Read it and you decide!';
  }

  // could not authenticate user earlier, so must do it here
  let client = '';
  try {
    client = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
  } catch (e) {
    // do nothing if auth fails, continue with page
  }

  // populates citation, review and comments lists, if any data can be found
  el.pubInspect.citation.innerHTML = '';
  const citations = await Controller.queryRequest('GET', `citation/${View.params.publish.id}`);
  if (citations === 404 || citations === 201) {
    el.pubInspect.citation.textContent = 'Error loading citations. There may have been a network issue or there may be no citations attached to this publication... worth an ask.';
  } else {
    populateCitationTemplate(citations, el.pubInspect.citation);
  }
  el.pubInspect.reviewList.innerHTML = '';
  const reviews = await Controller.queryRequest('GET', `review/${View.params.review.id}&${View.params.review.offset}`);
  if (reviews === 404) {
    el.pubInspect.reviewList.textContent = 'Error loading reviews. Please get in touch with the developer if this error occurs after a refresh. You should still be able to leave a review.';
    el.pubInspect.reviewOffset.classList.add('flex');
  } else if (reviews === 201 && View.params.review.offset === 0) {
    el.pubInspect.reviewList.textContent = 'This publication has no reviews.';
    // don't let users review their own papers
    if (client === 201 || client == 404) {
      el.pubInspect.reviewOffset.style.display = 'none';
      el.pubInspect.reviewList.textContent += ' Be the first to leave one!'
    } else { el.pubInspect.reviewOffset.style.display = 'flex'; }
  } else {
    el.pubInspect.reviewOffset.style.display = 'none';
    if (client === 201 || client == 404) {
      await populateReviewTemplate(reviews, el.pubInspect.reviewList);
    } else {
      await populateReviewTemplate(reviews, el.pubInspect.reviewList, client[0].userid);
    }
    // handler to deal with progressive loading of reviews
    if (!el.pubInspect.reviewOffset.classList.contains('click')) {
      el.pubInspect.reviewOffset.classList.add('click');
      el.pubInspect.reviewOffset.addEventListener('click', async () => {
        el.pubInspect.reviewOffset.dataset.offset += 20;
        try {
          const reviews = await Controller.queryRequest('GET', `review/${View.params.review.id}&${el.pubInspect.reviewOffset.dataset.offset}`);
          if (client === 201 || client == 404) {
            await populateReviewTemplate(reviews, el.pubInspect.reviewList);
          } else {
            await populateReviewTemplate(reviews, el.pubInspect.reviewList, client[0].userid);
          }
        } catch (e) {

        }
      });
    }
  }

  // enable page elements based on ownership/signin status
  if (window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token !== undefined) {
    try {
      const check = await Controller.userTypeCheck(info.userid, window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
      if (check === true) {
        // if owner, show 'Edit' button
        el.pubInspect.edit.style.display = 'block';
        if (!el.pubInspect.edit.classList.contains('click')) {
          el.pubInspect.edit.classList.add('click');
          el.pubInspect.edit.addEventListener('click', () => {
            View.sessionStorage.setItem('page', 'pubManage');
            buildPublicationManagePage(info, citations);
          });
        }
      } else {
        // if logged in but not owner, allow user to make reviews
        el.pubInspect.reviewCont.style.display = 'block';
        // handler for submitting reviews
        if (!el.pubInspect.reviewSubmit.classList.contains('click')) {
          el.pubInspect.reviewSubmit.classList.add('click');
          el.pubInspect.reviewSubmit.addEventListener('click', async () => {
            if (el.pubInspect.reviewOf5.value !== 'null') {
              payload = {
                publish: info.id,
                content: el.pubInspect.reviewInput.value !== null ? el.pubInspect.reviewInput.value : null,
                of5: el.pubInspect.reviewOf5.value,
              };
              // submit review
              const check = await Controller.queryRequest('POST', 'review', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, payload);
              if (check === 200) {
                window.alert('Review posted!');
                // show review on page, attempt to send notification to publication owner
                await populateReviewTemplate(payload, el.pubInspect.reviewList, client[0].userid, true);
                Object.assign(View.skeleton.notif, {id: View.uuidCreate(), type: 'review', user: client[0].userid, publish: info.id, recipient: info.userid});
                await View.outgoingNotification();
              } else {
                window.alert('Error when posting review. Please try again, or if problems persist, contact the administrator.');
              }  
            } else {
              window.alert('You must rate the paper out of 5 to submit a review.');
            }
          });
        }
      }
    } catch (e) {
      return e;
    }
  } 
}

export async function buildPublicationManagePage(data, citations) {
  View.hidePages();
  View.resetParams();
  View.closeSidebars();
  el.pubManage.page.style.display = 'block';
  el.pubManage.submit.style.display = 'none';
  el.pubManage.delete.style.display = 'none';
  let file;
  // check if user is uploading a brand-new publication; get all dependent elements sorted first
  el.pubManage.page.dataset.id = data ? data.id : View.uuidCreate();
  el.pubManage.page.children[0].textContent = data ? 'Editing Publication' : 'Upload New Publication';
  el.pubManage.title.value = data ? data.title : null;
  el.pubManage.abstract.value = data ? data.abstract : null;
  el.pubManage.citationList.innerHTML = citations ? '' : 'As you add citations, they will be listed here.';
  el.pubManage.fileButton.dataset.exist = data ? data.path : null,
  el.pubManage.fileCheck.dataset.check = 'false', el.pubManage.fileButton.style.display = 'none';
  el.pubManage.linkCheck.dataset.check = 'false', el.pubManage.link.style.display = 'none';

  // get areas; if existing data in list, clears list except for placeholder value
  for (let i = el.pubManage.area.options.length - 1; i >= 1; i--) {
    el.pubManage.area.remove(i);
  }
  // reset value
  el.pubManage.area.options[0].selected = 'selected';
  el.pubManage.area.options[0].value = 'null';
  el.pubManage.area.options[0].textContent = '--no area--';
  const areas = await Controller.queryRequest('GET', 'area');
  if (areas === 201 || areas === 404) {
    el.pubManage.area.options[0].textContent = 'Error listing areas';
  } else {
    areas.forEach(item => {
      const obj = item.json_build_object;
      let child = document.createElement('option');
      child.value = obj.id;
      child.textContent = obj.name;
      // if pre-existing data exists, replace default value with
      if (data && obj.name === data.areaname) {
        child.selected = 'selected';
        el.pubManage.area.prepend(child);
      } else {
        el.pubManage.area.appendChild(child);
      }
    });
  }
  
  // get cohorts; if existing data in list, clears list except for placeholder value
  for (let i = el.pubManage.cohort.options.length - 1; i >= 1; i--) {
    el.pubManage.cohort.remove(i);
  }
  if (data) { queryString = `cohortuser/${data.userid}&${View.params.cohortUser.cohort}`; } 
  else { 
    let id = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    queryString = `cohortuser/${id[0].userid}&${View.params.cohortUser.cohort}`; }
  
  const cohorts = await Controller.queryRequest('GET', queryString);
  if (cohorts === 404) {
    el.pubManage.cohort.options[0].textContent = 'Error listing areas';
  } else if (cohorts === 201) {
    el.pubManage.cohort.options[0].textContent = 'No cohorts joined';
  } else {
    cohorts.forEach(item => {
      const obj = item.json_build_object;
      let child = document.createElement('option');
      child.value = obj.id;
      child.textContent = obj.name;
      // if pre-existing data exists, replace default value with
      if (data && obj.name === data.cohortname) {
        child.selected = 'selected';
        el.pubManage.cohort.prepend(child);
      } else {
        el.pubManage.cohort.appendChild(child);
      }
    });
  }

  // if citations, pre-add to list
  if (citations) {
    populateCitationTemplate(citations, el.pubManage.citationList, true);
  }

  // event listener for adding citations to the list
  if (!el.pubManage.citationAdd.classList.contains('click')) {
    el.pubManage.citationAdd.classList.add('click');
    el.pubManage.citationAdd.addEventListener('click', () => {
      // clears text if adding first citation
      if (el.pubManage.citationText.value === '' || el.pubManage.citationLink.value === '') {
        window.alert('Citations require a link and accompanying text.');
      } else {
        if (el.pubManage.citationList.innerHTML === 'As you add citations, they will be listed here.') { el.pubManage.citationList.innerHTML = ''; }
        citations = [{json_build_object: {text: el.pubManage.citationText.value, link: el.pubManage.citationLink.value}}];
        populateCitationTemplate(citations, el.pubManage.citationList, 'new');
      }
    });
  }  
  
  if (data && data.link !== null) { Object.assign(el, { linkCheck: {...el.pubManage.linkCheck.dataset.check = 'true'}, link: {...el.pubManage.link.style.display = 'flex'} } )}
  else if (data && data.path !== null) { Object.assign(el, { fileCheck: {...el.pubManage.fileCheck.dataset.check = 'true'}, fileButton: {...el.pubManage.fileButton.style.display = 'flex'} } )}
  // event handler for user changing type of upload. initial setup if pre-existing data 
  // i tried adding these events the normal way but they all kept duplicating
  if (!el.pubManage.linkCheck.classList.contains('click')) {
    el.pubManage.linkCheck.classList.add('click');
    el.pubManage.linkCheck.addEventListener('click', () => {
      Object.assign(el, { linkCheck: {...el.pubManage.linkCheck.dataset.check = 'true'}, fileCheck: {...el.pubManage.fileCheck.dataset.check = 'false'},
      fileButton: {...el.pubManage.fileButton.style.display = 'none' }, link: {...el.pubManage.link.style.display = 'flex'}, 
      fileInput: {...el.pubManage.fileInput.value = null }, fileInput: {...el.pubManage.fileInput.textContent = 'Choose PDF'} } );
    });
  }
  if (!el.pubManage.fileCheck.classList.contains('click')) {
    el.pubManage.fileCheck.classList.add('click');
    el.pubManage.fileCheck.addEventListener('click', () => {
      Object.assign(el, { fileCheck: {...el.pubManage.fileCheck.dataset.check = 'true'}, linkCheck: {...el.pubManage.linkCheck.dataset.check = 'false'},
      fileButton: {...el.pubManage.fileButton.style.display = 'flex' }, link: {...el.pubManage.link.style.display = 'none'}, 
      link: el.pubManage.link.value = ''} );

    });
  }

  // event handler for hidden button element
  if (!el.pubManage.fileButton.classList.contains('click')) {
    el.pubManage.fileButton.classList.add('click');
    el.pubManage.fileButton.addEventListener('click', async () => {
      el.pubManage.fileInput.click();
    });
  }

  // event for handling uploading a file
  if (!el.pubManage.fileInput.classList.contains('input')) {
    el.pubManage.fileInput.classList.add('input');
    el.pubManage.fileInput.addEventListener('input', async () => {
      // tests validity of file to avoid databasing errors
      const validityCheck = Controller.fileUploadValidator(el.pubManage.fileInput, 'application/pdf');
      if (validityCheck !== true) {
        window.alert('Invalid file. Reason: ' + validityCheck);
        return;
      }
      // relays filename to user
      el.pubManage.fileButton.textContent = el.pubManage.fileInput.files[0].name;
      file = el.pubManage.fileInput.files[0];
    });
  }

  // event handler for data submission. prepares form data if a file has been uploaded
  async function submitData() {
    el.pubManage.submit.classList.add('click');
    // input validity; must have new uploaded/previously existed file or link to be valid
    if ((el.pubManage.fileInput.value === '' && (data && !data.path)) && (el.pubManage.link.value === '' && (data && !data.link)) || el.pubManage.title.value === '') {
      window.alert('Your publication must be either a .pdf or an external weblink, and have a title.');
      return;
    }
    // if there is a file involved, set it up as FormData for submission
    try {
      let form; 
      if (file) {
        // populate FormData and send to database. if image has changed, send; if not, send original image
        let formData = new FormData();
        formData.append('file', file);
        // arrays to loop through for form data population
        const elements = [el.pubManage.title.value, el.pubManage.area.value, el.pubManage.cohort.value, el.pubManage.abstract.value, 'null'];
        const formFields = ['title', 'area', 'cohort', 'abstract', 'link'];
        // loop to tidily populate form data with text values. inserts null if values are empty
        for (let i = 0; i <= 4; i++) {
          if (elements[i] !== '' || elements[i] !== 'null') {
            formData.append(formFields[i], elements[i]);
          } else {
            formData.append(formFields[i], null);
          }
        } 
        // if an id exists, append it to enable update queries
        if (data && data.id) {
          formData.append('id', el.pubManage.page.dataset.id);
          queryString = ['PUT', 'publish', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, formData];
          form = true;
        } else {
          // if not, generate uuid and attach to payload
          formData.append('id', View.uuidCreate());
          queryString = ['POST', 'publish', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, formData];
          form = true;
        }
      } else if (data) {
        // set up form with pre-existing ID for update query, no file included
        payload = {
          id: el.pubManage.page.dataset.id,
          file: el.pubManage.fileButton.dataset.exist !== '' ? el.pubManage.fileButton.dataset.exist : null,
          link: el.pubManage.link.value !== '' ? el.pubManage.link.value : null,
          title: el.pubManage.title.value,
          abstract: el.pubManage.abstract.value !== '' ? el.pubManage.abstract.value : null,
          cohort: el.pubManage.cohort.value !== 'null' ? el.pubManage.cohort.value : null,
          area: el.pubManage.area.value !== 'null' ? el.pubManage.area.value : null,
        };
        queryString = ['PUT', 'publish', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, payload];
      } else {
        // set up form with new id or file for new sumbmission query
        payload = {
          id: View.uuidCreate(),
          file: null,
          link: (el.pubManage.link.value !== '') ? el.pubManage.link.value : null,
          title: el.pubManage.title.value,
          abstract: el.pubManage.abstract.value !== '' ? el.pubManage.abstract.value : null,
          cohort: el.pubManage.cohort.value !== 'null' ? el.pubManage.cohort.value : null,
          area: el.pubManage.area.value !== 'null' ? el.pubManage.area.value : null,
        };
        queryString = ['POST', 'publish', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, payload];
      }
      // send the query; add the formdata checker if necessary
      let check;
      if (form === true) { check = await Controller.queryRequest(queryString[0], queryString[1], queryString[2], queryString[3], form); }
      else { check = await Controller.queryRequest(queryString[0], queryString[1], queryString[2], queryString[3]); }
      if (check === 200) {
        // prepare to send all new citations, don't update list on failed input
        let payloadArray = [];
        // loop through all citations in the list; pick out the ones with the 'new' dataset, as they're not in the database
        try {
          Object.keys(el.pubManage.citationList.children).forEach(item => {
            console.log(el.pubManage.citationList.children[item]);
            // push to array if new item
            if (el.pubManage.citationList.children[item].dataset.new) {
              payloadArray.push({ text: el.pubManage.citationList.children[item].children[0].textContent, link: el.pubManage.citationList.children[item].children[0].href.slice(22), publish: el.pubManage.page.dataset.id });
            } 
          });
          // send to database
          await Controller.queryRequest('POST', 'citation', payloadArray);
        } catch (e) {
          // if loop fails, no new citations found, no need to send any
        }
      } else {
        window.alert('Something went wrong when saving your publication. If it happens again after a refresh, contact the developer and give him this number: ' + check);
        return;
      }
      window.alert('Data saved successfully.');
      // navigate away from page on success. no id is granted from the post; just lead them  to the list pages
      el.pubManage.submit.style.display = 'none';
      el.pubManage.fileButton.dataset.exist = null;
      el.pubManage.fileInput.value = null;
      if (data) {
        View.sessionStorage.setItem('page', 'pubView');
        View.sessionStorage.setItem('id', el.pubManage.page.dataset.id);
        View.showPublicationPage();
      } else {
        View.sessionStorage.setItem('page', 'yourPubList');
        let id = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
        View.sessionStorage.setItem('id', (typeof id == 'string') ? id : '0');
        View.showYourSidebarList();
      }
    } catch (e) {
      window.alert('Something went wrong when saving your publication. If it happens again after a refresh, contact the developer and tell him this: ' + e);
    } 
  }

  // event handler for deleting publication 
  async function deletePub() {
    if (window.confirm('Are you sure you want to delete your publication? It can\'t be recovered once you do, and it\'ll lose all its reviews.') === true) {
      try {
        const check = await Controller.queryRequest('DELETE', `publish/${data.id}`);
        el.pubManage.delete.style.display = 'none';
        window.alert('Publication deleted.');
        View.sessionStorage.setItem('id', '0');
        View.sessionStorage.setItem('page', 'feed');
        View.showFeedPage();
      } catch (e) {
        window.alert('Error deleting your publication. It refuses to die! Refresh and try again. If it still doesn\'t work, please get in touch with the developer.' + e);
      }
    }
  }
  // authorise current user to prevent data tampering with event listeners and lingering data
  if (data) {
    if (await Controller.userTypeCheck(data.userid, window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token)) {
      el.pubManage.submit.style.display = 'flex';
      if (!el.pubManage.submit.classList.contains('click')) { el.pubManage.submit.addEventListener('click', submitData); }
      el.pubManage.delete.style.display = 'flex';
      if (!el.pubManage.delete.classList.contains('click')) { el.pubManage.delete.addEventListener('click', deletePub); }
    }
  } else {
    el.pubManage.submit.style.display = 'flex';
    if (!el.pubManage.submit.classList.contains('click')) { el.pubManage.submit.addEventListener('click', submitData); }
  }
}

export async function buildCohortViewPage() {
  // get cohort data
  queryString = `cohort/${View.params.cohort.id}&${View.params.cohort.name}&${View.params.cohort.offset}`;
  const data = await Controller.queryRequest('GET', queryString);
  if (data === 404 || data === 201) {
    View.showErrorPage(data);
    return;
  } 
  // gets response data into more readable state
  const info = data[0].json_build_object;
  console.log(info);
  // populate page
  el.cohortInspect.page.dataset.id = info.id;
  el.cohortInspect.name.textContent = info.name;
  el.cohortInspect.avatar.src = info.avatar;
  el.cohortInspect.birthday.textContent = 'Cohort birthday: ' + info.birthday;
  el.cohortInspect.admin.textContent = 'Administrator: ' + info.adminname;
  el.cohortInspect.admin.dataset.id = info.admin;
  el.cohortInspect.desc.textContent = info.desc ? info.desc : null;

  // add event listener for navigating to admin page
  if (!el.cohortInspect.admin.classList.contains('click')) {
    el.cohortInspect.admin.classList.add('click');
    el.cohortInspect.admin.addEventListener('click', () => {
      View.sessionStorage.setItem('page', 'userView');
      View.sessionStorage.setItem('id', el.cohortInspect.admin.dataset.id);
      View.showPublicationPage();
    });
  }

  // populate list of cohort members
  queryString = `cohortuser/${View.params.cohortUser.user}&${View.params.cohortUser.cohort}`;
  el.cohortInspect.users.innerHTML = '';
  const users = await Controller.queryRequest('GET', queryString);
  if (users === 404) {
    el.cohortInspect.users.textContent = 'Error loading users. If problem persist after a refresh, yell at the developer; contact info in our About page.';
  } else {
    populateListTemplate(users, el.cohortInspect.users);
  }

  // populate list of cohort's publications
  queryString = `publish/${View.params.publish.id}&${View.params.publish.user}&${View.params.publish.cohort}&${View.params.publish.title}&${View.params.publish.offset}&`;
  el.cohortInspect.pubs.innerHTML = '';
  const pubs = await Controller.queryRequest('GET', queryString);
  if (pubs === 404) {
    el.cohortInspect.pubs.textContent = 'Error loading publications. If problem persist after a refresh, then I blame the technodemons (but you should tell the developer anyway).';
  } else if (pubs === 201) {
    el.cohortInspect.pubs.textContent = 'There are no publications linked to this cohort yet.';
  } else {
    populateListTemplate(users, el.cohortInspect.pubs);
  }
  
  // authenticate user; hide elements/add event listeners based on their signin/admin status
  let client = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
  if (client === 404 || client == 500 || client === 201) {  }
  else {
    const check = await Controller.userTypeCheck(el.cohortInspect.admin.dataset.id, window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
    if (check === true) {
      // show 'Edit' button and add event listener if user is cohort admin
      el.cohortInspect.edit.style.display = 'flex';
      if (!el.cohortInspect.edit.classList.contains('click')) {
        el.cohortInspect.edit.classList.add('click');
        el.cohortInspect.edit.addEventListener('click', () => {
          View.sessionStorage.setItem('page', 'cohortManage');
          View.sessionStorage.setItem('id', el.cohortInspect.page.dataset.id);
          buildCohortManagePage(info, pubs);
        });
      }
    }
  }
}


export async function buildCohortManagePage(data, pubs) {
  // clear other pages, show relevent page
  View.hidePages();
  View.resetParams();
  View.closeSidebars();
  el.cohortManage.page.style.display = 'block';

  // populate page; account for if user is creating a new cohort
  el.cohortManage.page.dataset.id = data ? data.id : null;
  el.cohortManage.avatar.src = data ? data.avatar : './assets/placeholder-cohort.png';
  el.cohortManage.name.value = data ? data.name : null;
  el.cohortManage.desc.value = data ? data.desc : null;
  View.params.cohortUser.cohort = data? data.id : null;
  let img;

  // event handler for image upload button element
  if (!el.cohortManage.avatarButton.classList.contains('click')) {
    el.cohortManage.avatarButton.classList.add('click');
    el.cohortManage.avatarButton.addEventListener('click', async () => {
      el.cohortManage.avatarUpload.click();
    });
  }

  // event handler for image file upload
  if (!el.cohortManage.avatarButton.classList.contains('click')) {
    el.cohortManage.avatarButton.classList.add('click');
    el.cohortManage.avatarUpload.addEventListener('input', () => {
      // tests validity of file to avoid databasing errors
      const validityCheck = Controller.fileUploadValidator(el.cohortManage.avatarUpload, 'image/png');
      if (validityCheck !== true) {
        window.alert('Invalid image. Reason: ' + validityCheck);
        return;
      }
      // displays image on page, but saves usable image path for insertion into database
      el.cohortManage.avatar.src = URL.createObjectURL(el.cohortManage.avatarUpload.files[0]);
      img = el.cohortManage.avatarUpload.files[0];
    });
  }

  // these elements/listeners only apply if user is editing existing cohort
  if (data) {
    // populate list of cohort members. add admin powers to kick/promote users in list
    queryString = `cohortuser/${View.params.cohortUser.user}&${View.params.cohortUser.cohort}`;
    el.cohortManage.users.innerHTML = '';
    el.cohortManage.pubs.innerHTML = '';
    const users = await Controller.queryRequest('GET', queryString);
    if (users === 404) {
      el.cohortManage.users.textContent = 'Error loading users. If problem persist after a refresh, yell at the developer; contact info in our About page.';
    } else if (users === 201) {
      el.cohortManage.users.textContent = 'You\'re the only one here. Visit other users pages and send some invites out!';
    } else {
      populateListTemplate(users, el.cohortManage.users, data.admin);
    }
  } else if (pubs) {
    populateListTemplate(pubs, el.cohortManage.pubs);
  } else {
    el.cohortManage.pubs.textContent = 'Error loading publications. If problem persist after a refresh, yell at the developer; contact info in our About page.';
  }

  // handler to submit form data
  if (!el.cohortManage.submit.classList.contains('click')) {
    el.cohortManage.submit.classList.add('click');
    el.cohortManage.submit.addEventListener('click', async () => {
      const elements = [el.cohortManage.name.value, el.cohortManage.desc.value];
      const formFields = ['name', 'desc'];
      // populate FormData and send to database. if image has changed, send as FormData; if not, send as JSON object
      let form;
      if (img) {
        // perhaps over-engineered for two items, but i like this loop damnit
        let formData = new FormData();
        form.append('avatar', img);
        // loop to tidily populate form data with text values. inserts null if values are empty
        for (let i=0; i<=2; i++) {
          if (elements[i] !== '') {
            form.append(formFields[i], elements[i]);
          } else {
            form.append(formFields[i], null);
          }
        }
        // if an id exists, append it to enable update queries
        if (data && data.id) {
          formData.append('id', el.cohortManage.page.dataset.id);
          queryString = ['PUT', 'cohort', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, formData];
          form = true;
        } else {
          // if not, database generates uuids
          queryString = ['POST', 'cohort', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, formData];
          form = true;
        }
      } else {
        // if pre-existing/placeholder image, append path to json object
        payload = {
          name: el.cohortManage.name.value !== '' ? el.cohortManage.name.value : null,
          desc: el.cohortManage.desc.value !== '' ? el.cohortManage.desc.value : null,
          avatar: el.cohortManage.avatar.dataset.exist,
        };
        // test for pre-existing id to see if request is 'PUT' or 'POST'
        if (el.cohortManage.page.dataset.id === null) { 
          queryString = ['POST', 'cohort', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, payload]; 
        } else { 
          payload.id = el.cohortManage.page.dataset.id;
          queryString = ['PUT', 'cohort', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, payload]; 
        }
      }

      //send request
      let check;
      if (form === true) { check = await Controller.queryRequest(queryString[0], queryString[1], queryString[2], queryString[3], form); }
      else { check = await Controller.queryRequest(queryString[0], queryString[1], queryString[2], queryString[3]); }
      if (check === 200) {
        window.alert('Cohort info saved!');
        // on success, load view-only version of user page
        // navigate away from page on success. no id is granted from the post; just lead them  to the list pages
        el.cohortManage.submit.style.display = 'none';
        el.cohortManage.avatarButton.dataset.exist = null;
        el.cohortManage.avatarUpload.value = null;
        if (data) {
          View.sessionStorage.setItem('page', 'pubView');
          View.sessionStorage.setItem('id', el.cohortManage.page.dataset.id);
          View.showPublicationPage();
        } else {
          let id = await Controller.queryRequest('GET', 'login', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
          View.sessionStorage.setItem('id', id[0].userid);
          View.sessionStorage.setItem('page', 'yourCohortList');
          View.showYourSidebarList();
        }
      }
      else {
        window.alert('Issue saving data. If problem persists, contact the administrator.');
      }
    });
  }

  // event handler for deleting publication 
  if (!el.cohortManage.delete.classList.contains('click')) {
    el.cohortManage.delete.classList.add('click');
    el.cohortManage.delete.addEventListener('click', async () => {
      if (window.confirm('Are you sure you want to delete your publication? It can\'t be recovered once you do, and it\'ll lose all its reviews.') === true) {
        try {
          await Controller.queryRequest('DELETE', `cohort/${el.cohortManage.page.dataset.id}`);
          el.cohortManage.delete.style.display = 'none';
          window.alert('Cohort deleted.');
          View.sessionStorage.setItem('id', '0');
          View.sessionStorage.setItem('page', 'feed');
          View.showFeedPage();
        } catch (e) {
          window.alert('Error deleting your publication. It refuses to die! Refresh and try again. If it still doesn\'t work, please get in touch with the developer.' + e);
        }
      }
    });
  }
}

/** Functions listed below populate lists using templates
 * @param data used in all below functions, json object of retrieved data
 * @param parent used in all below functions, parent DOM node to append rows to
 * @function populateFeedTemplate sets up list of publications
 * @function populateResultTemplate sets up list of user/cohorts where image detail is included
 * @function populateListTemplate sets up list of user/cohorts, that lack image detail but have certain auth-enabled options
 * * @param auth true if auth enabled on given page
 * @function populateCommentTemplate sets up list of comments, attached to review as main parent
 * * @param auth if exists, new comment; so append to list
 * @function populateReviewTemplate sets up list of reviews for appropriate pages
 * * @param auth if exists, new review; prepended to top of list
 * @function populateCitationTemplate sets up list of citations for approprate pages
 * * @param auth if boolean, allow for deletion. if string, add to list for formdata
 */

export function populateFeedTemplate(data, parent, your) {
  // see 'feed-template' in index.html for template structre
  data.forEach(item => {
    // populates page with publications if selected
    const template = el.templates.feed.content.cloneNode(true);
    const row = template.querySelector('.feed-item');
    // gets response data into more readable state
    const obj = item.json_build_object;
    row.id = obj.id;
    // stops overly-long title overflowing and making the divs too big
    if (obj.title.length >= 150) {
      obj.title = obj.title.substring(0, 75) + '...';
    }
    row.children[0].textContent = obj.title;
    row.children[1].textContent = obj.time.substring(0, 10);
    if (obj.dispname) {
      row.children[2].textContent = 'Author: ' + obj.dispname;
    } else if (your) {
      row.children[2].remove();
    } else {
      row.children[2].textContent = 'Unnamed user';
    }
    // stops overly-long abstracts overflowing and making the divs too big
    if (obj.abstract !== null && obj.abstract.length >= 150) {
      obj.abstract = obj.abstract.substring(0, 150) + '...';
    }
    row.children[3].textContent = obj.abstract;
    // click event to take user to related publication
    row.addEventListener('click', () => {
      View.sessionStorage.setItem('id', row.id);
      View.sessionStorage.setItem('page', 'pubView');
      View.showPublicationPage();
    });
    parent.appendChild(template);
  });
}

export function populateResultTemplate(data, parent) {
  // see 'result-template' in index.html for template structre
  data.forEach(item => {
    // populates page with publications if selected
    const template = el.templates.result.content.cloneNode(true);
    const row = template.querySelector('.result-item');
    // gets response data into more readable state
    const obj = item.json_build_object;
    row.id = obj.id;
    // applies avatar if one retrieved
    if (obj.avatar !== null) {
      row.children[0].src = obj.avatar;
    }
    // finalises row dependent on query parameters
    // if request was for cohorts
    if (View.sessionStorage.getItem('page') === 'yourCohortList' || View.params.cohort.name !== null) {
      row.children[1].textContent = obj.name;
      row.addEventListener('click', () => {
        View.sessionStorage.setItem('id', row.id);
        View.sessionStorage.setItem('page', 'cohortView');
        View.showCohortPage();
      });
    } else {
      // if not, request was for user
      row.children[1].textContent = obj.dispname;
      row.addEventListener('click', () => {
        View.sessionStorage.setItem('id', row.id);
        View.sessionStorage.setItem('page', 'userView');
        View.showUserPage();
      });
    }
    parent.appendChild(template);
  });
} 

export function populateListTemplate(data, parent, auth) {
  // see 'list-template' in index.html for template structre
  try {
    data.forEach(item => {
      // populates page with publications if selected
      const template = el.templates.list.content.cloneNode(true);
      const row = template.querySelector('.list-item');
      const obj = item.json_build_object;
      row.id = obj.id;
      console.log(item);
      // populates lists mildly differently based on parent choice
      switch (parent) {
        case el.userInspect.pubs:
          row.children[0].textContent = obj.title;
          row.addEventListener('click', () => {
            View.sessionStorage.setItem('id', row.id);
            View.sessionStorage.setItem('page', 'pubView');
            View.showPublicationPage();
          });
          break;
        case el.userInspect.cohorts:
          row.children[0].textContent = obj.name;
          row.addEventListener('click', () => {
            View.sessionStorage.setItem('id', row.id);
            View.sessionStorage.setItem('page', 'cohortView');
            View.showCohortPage();
          });
          break;
        case el.cohortInspect.pubs:
          row.children[0].textContent = obj.title;
          row.addEventListener('click', () => {
            View.sessionStorage.setItem('id', row.id);
            View.sessionStorage.setItem('page', 'pubView');
            View.showPublicationPage();
          });
          break;
        case el.cohortInspect.users:
          row.children[0].textContent = obj.disp;
          row.addEventListener('click', () => {
            View.sessionStorage.setItem('id', row.id);
            View.sessionStorage.setItem('page', 'pubView');
            View.showPublicationPage();
          });
          break;
        case el.cohortManage.users:
          // if cohort admin and inspecting; excludes rows that contain admin information
          row.children[0].textContent = obj.disp;          
          if (auth && auth !== row.id) {
            // set up event handler to change cohort admin
            row.children[1].style.display = 'flex';
            row.children[1].addEventListener('click', async () => {
              let change = window.confirm('Are you sure?');
              if (change) { 
                console.log(row.id, sessionStorage.getItem('id'));
                queryString = `cohort/${row.id}&${sessionStorage.getItem('id')}`;
                const check = await Controller.queryRequest('PUT', queryString);
                if (check === 200) {
                  window.alert('Admin changed!');
                  View.rebuildCurrentPage(true);
                } else {
                  window.alert('Error changing admin. Please try again or contact the administrator.');
                }
              }
            });
                
            // set up event handler to kick user from cohort
            row.children[2].style.display = 'flex';
            row.children[2].addEventListener('click', async () => {
              let kick = window.confirm('Are you sure?');
              if (kick) {
                payload = {
                  cohort: sessionStorage.getItem('id'),
                  user: row.id,
                };
                const check = await Controller.queryRequest('DELETE', 'cohort', payload);
                if (check === 200) {
                  window.alert('User kicked!');
                    template.remove();
                } else {
                  window.alert('Error kicking user. Please try again or contact the administrator.');
                }
              }
            });
          }
          break;
        default:
          break;
      }
      parent.appendChild(template);
    });
  } catch (e) {
  }
}

async function populateCommentTemplate(parent, auth, payload) {
  // see 'comment-template' in index.html for template structre
  // if auth, new comment
  if (payload) {
    const template = el.templates.comment.content.cloneNode(true);
    const row = template.querySelector('.comment-container');
    row.children[0].children[0].src = './assets/placeholder-avatar.png';
    row.children[0].children[1].textContent = 'Your new comment';
    row.children[0].children[2].textContent = 'Just now';
    row.children[1].textContent = payload.content;
    return;
  }

  // get comments from database, return empty code if none found
  const comments = await Controller.queryRequest('GET', `comment/${parent.id}`);
  if (comments === 201 || comments === 404) { return comments; }
  comments.forEach(item => {
    // populates page with publications if selected
    const template = el.templates.comment.content.cloneNode(true);
    const row = template.querySelector('.comment-container');
    const obj = item.json_build_object;
    row.id = obj.id;

    row.children[0].children[0].src = obj.avatar;
    row.children[0].children[1].textContent = obj.dispname;
    row.children[0].children[2].textContent = obj.time.substring(0, 9);

    // go to user's page on tapping their avatar
    row.children[0].children[0].addEventListener('click', () => {
      View.sessionStorage.setItem('id', row.id);
      View.sessionStorage.setItem('page', 'userView');
      View.showUserPage();
    });
    
    // if auth, allow for deletion
    if (auth) {
      row.children[0].children[3].style.display = 'flex'; 
      row.children[0].children[3].addEventListener('click', async () => {
        let check = await Controller.queryRequest('DELETE', `comment/${row.id}`);
        if (check === 200) {
          window.alert('Comment deleted.');
          row.remove();
        } else {
          row.children[2].textContent = 'Error when deleting comment. If the problem persists after a refresh, contact the administrator.';
        }
      });
    } 
    row.children[1].textContent = obj.content;
    parent.children[4].appendChild(template);
  });
}

async function populateReviewTemplate(data, parent, auth, check) {
  // see 'review-template' in index.html for template structre
  if (check && data.content !== null) { 
    // only visually adds the review if it has text content
    const template = el.templates.review.content.cloneNode(true);
    const row = template.querySelector('.review-container');
    // if check, create simpler review and prepend. workaround until i can get something better for posting reviews
    row.children[0].src = './assets/placeholder-avatar.png';
    row.children[1].children[0].textContent = 'Your review'; 
    let star = row.children[1].children[1].innerHTML.slice(2);
    row.children[1].children[1].innerHTML = `${data.of5}/5${star}`; 
    row.children[1].children[2].textContent = 'Just now';
    row.children[2].textContent = data.content ? data.content : '';
    parent.prepend(row);
    return;
  }

  data.forEach(item => {
    if (item.json_build_object.content !== null) {
      // only visually adds the review if it has text content
      const template = el.templates.review.content.cloneNode(true);
      const row = template.querySelector('.review-container');
      const obj = item.json_build_object;
      row.id = obj.id;
      row.poster = obj.poster;
      row.children[0].src = obj.avatar;
      // go to user's page on tapping their avatar
      row.children[0].addEventListener('click', () => {
        View.sessionStorage.setItem('id', row.poster);
        View.sessionStorage.setItem('page', 'userView');
        View.showUserPage();
      });
      row.children[1].children[0].textContent = obj.dispname;
      let star = row.children[1].children[1].innerHTML.slice(2);
      row.children[1].children[1].innerHTML = `${obj.of5}/5${star}`; 
      row.children[1].children[2].textContent = obj.time.substring(0, 9);
      row.children[2].textContent = obj.content;

      // list comments. comments loaded on demand to avoid long loading times
      row.children[4].addEventListener('click', async () => {
        // check if user is logged in for comment posting ability
        let check;
        if (window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token !== undefined) {
          try {
            row.children[4].innerHTML = '';
            check = await populateCommentTemplate(row, auth);
            // click event to handle posting a comment
            if (check === 201) {
              row.children[4].textContent = 'No comments. Be the first to leave one!';
              return;
            }
            row.children[5].classList.add('section');
            row.children[5].children[3].addEventListener('click', async () => {
              if (row.children[5].children[2].value === '') {
                window.alert('Comment bar is empty!');
                return;
              } else {
                let payload = {
                  review: row.id,
                  content: row.children[5].children[2].value,
                };
                // post comment to database, send notification
                let check = await Controller.queryRequest('POST', 'comment', window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token, payload);
                if (check === 200) {
                  await populateCommentTemplate(row, auth, payload);
                  Object.assign(View.skeleton.notif, {id: View.uuidCreate(), type: 'comment', user: auth, publish: View.sessionStorage.getItem('id'), review: row.id, recipient: obj.poster});
                  console.dir(View.skeleton.notif);
                  await View.outgoingNotification();
                } else {
                  // handles if not posted
                  window.alert('Error posting comment. If problem persists after a refresh, please contact the administrator.');
                }
              }
            });
          } catch (e) {
            row.children[4].textContent = 'Error loading single comments. If problems persist after a refresh, please contact the adminstrator. ' + e;
          }
        } else {
          try {
            row.children[4].textContent = '';
            await populateCommentTemplate(row);
          } catch (e) {
            row.children[4].textContent = 'Error loading  doublecomments. If problems persist after a refresh, please contact the adminstrator.';
          }
        }
      });

      // check if user posted this review; click event to delete review
      if (auth === row.poster) {
        row.children[1].children[3].style.display = 'flex'; 
        row.children[1].children[3].addEventListener('click', async () => {
          let check = await Controller.queryRequest('DELETE', `review/${row.poster}`);
          if (check === 200) {
            window.alert('Review deleted.');
            row.remove();
          } else {
            row.children[2].textContent = 'Error when deleting review. If the problem persists, contact the administrator';
          }
        });
      }
      parent.appendChild(template);
    } 
  });
}

function populateCitationTemplate(data, parent, auth) {
  // see 'citation-template' in index.html for template structure
  try {
    data.forEach(item => {
      // populates page with publications if selected
      const template = el.templates.citation.content.cloneNode(true);
      const row = template.querySelector('.citation-container');
      const obj = item.json_build_object;
      row.id = obj.id ? obj.id : null;
      row.poster = obj.poster;
      row.children[0].textContent = obj.text;
      row.children[0].href = obj.link;
      if (auth === true) {
        row.children[1].style.display = 'flex';
        row.children[1].addEventListener('click', async () => {
          console.log(row.poster);
          let check = await Controller.queryRequest('DELETE', `citation/${row.poster}`);
          if (check === 200) {
            row.remove();
          } else {
            row.children[0].textContent = 'Error when deleting citation. If the problem persists, contact the administrator';
          }
        });
      } else if (auth === 'new') {
        row.dataset.new = true;
        row.children[1].style.display = 'flex';
        row.children[1].addEventListener('click', () => {
          row.remove();
        });
      }
      parent.prepend(template);
    });
  } catch (e) {
    return e;
  }
}
