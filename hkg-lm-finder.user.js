// ==UserScript==
// @name           HKG LM finder
// @namespace      http://github.com/Xelio/
// @version        5.1.0
// @description    HKG LM finder
// @downloadURL    https://github.com/Xelio/hkg-lm-finder/raw/master/hkg-lm-finder.user.js
// @include        http://forum*.hkgolden.com/profilepage.aspx?userid=*
// @include        http://profile.hkgolden.com/profilepage.aspx?userid=*
// @match          http://*.hkgolden.com/profilepage.aspx?userid=*
// @require        http://code.jquery.com/jquery-1.9.1.min.js
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @copyright      2013, Xelio, Peach(Fix of PM, 紅人榜)
// ==/UserScript==

/*
HKG LM finder (HKGolden LM finder)
Copyright (C) 2013 Xelio Cheong

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var $j = jQuery.noConflict();

var viewStateOutdate = 15 * 60 * 1000;
var ajaxTimeout = 15000;
var ajaxRequest;
var ajaxRequestTimer;
var viewState;
var eventValidation;

var changePage;
var changeFilterType;

var useFullRequest = false;
var needLogin = false;

// Monitor window.LM_CHANGE_PAGE and window.LM_CHANGE_FILTER_TYPE and fire
// ajax request to change page or filter. 
// Use this monitoring method because page cannot directly call function in 
// Greasemonkey script context. 
pageChangeByAjax = function() {
  if((window.LM_CHANGE_PAGE && window.LM_CHANGE_PAGE !== window.LM_CURRENT_PAGE)
      ||(window.LM_CHANGE_FILTER_TYPE && window.LM_CHANGE_FILTER_TYPE !== window.LM_FILTER_TYPE)) {
    initPagePartial();

    if(window.LM_CHANGE_PAGE) changePage = window.LM_CHANGE_PAGE;
    window.LM_CHANGE_PAGE = null;

    if(window.LM_CHANGE_FILTER_TYPE) changeFilterType = window.LM_CHANGE_FILTER_TYPE;
    window.LM_CHANGE_FILTER_TYPE = null;

    var history = $j('div#lm_history');
    history.find('#lm_btn_Next').attr("disabled", true);
    history.find('#lm_btn_Previous').attr("disabled", true);
    history.find('#lm_btn_GoPageNo').attr("disabled", true);
    history.find('#lm_filter_type').attr("disabled", true);

    requestProfilePage(changePage, changeFilterType);
  } else {
    setTimeout(pageChangeByAjax, 200);
  }
}

// Init options for full page loading
initPageFull = function() {
  viewState = null;
  eventValidation = null;
}

// Init options for partial page loading
initPagePartial = function() {
  viewState = GM_getValue('viewstate');
  eventValidation = GM_getValue('eventvalidation');
  changePage = parseInt(loadLocal('lm_change_page')) || 1;
  changeFilterType = loadLocal('lm_filter_type') || 'all';

  if(!viewState || !eventValidation || !changePage) return false;
  return true;
}

requestProfilePage = function(page, filter_type) {
  var requestType = (page ? 'partial' : 'full');
  var requestParm;

  var message = 'Load 緊<img src="faces/angel.gif" />';
  changeAndFlashMessage(message);

  var requestUrl = window.location.href;

  var requestParmShared = {
    url: requestUrl,
    timeout: ajaxTimeout,
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    onload: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        if(replaceContent(response)) {
          storeStatus();
          popupLoginWindow();
          setTimeout(pageChangeByAjax, 200);
        } else {
          handleError();
        }
      },
    onerror: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        handleError();
      },
    ontimeout: handleTimeout
  };

  if(requestType === 'partial') {
    var data = $j.param({
          'ctl00$ScriptManager1': 'ctl00$ScriptManager1|ctl00$ContentPlaceHolder1$mainTab$mainTab1$btn_GoPageNo',
          'ctl00_ContentPlaceHolder1_tc_Profile_ClientState': '{"ActiveTabIndex":0,"TabState":[true,true,true]}',
          'ctl00_ContentPlaceHolder1_mainTab_ClientState': '{"ActiveTabIndex":0,"TabState":[true,true]}',
          'ctl00$ContentPlaceHolder1$tc_Profile$tb0$txt_nickname': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb0$txt_reli': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb0$txt_website': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb1$ddl_re_status': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb1$txt_lookingfor': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb2$txt_fav': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb2$txt_favsports': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb2$txt_favmusic': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb2$txt_favbooks': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb2$txt_favmovies': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb2$txt_favquotes': null,
          'ctl00$ContentPlaceHolder1$tc_Profile$tb2$txt_abtme': null,
          'ctl00$ContentPlaceHolder1$mainTab$mainTab1$ddl_filter_year': 1,
          'ctl00$ContentPlaceHolder1$mainTab$mainTab1$filter_type': (filter_type || 'all'),
          'ctl00$ContentPlaceHolder1$mainTab$mainTab1$PageNoTextBox': page,
          'ctl00$ContentPlaceHolder1$GiftBeerTextBox': null,
          'ctl00$ContentPlaceHolder1$GiftKauTextBox': null,
          '__EVENTTARGET': null,
          '__EVENTARGUMENT': null,
          '__LASTFOCUS': null,
          '__VIEWSTATE': viewState,
          '__EVENTVALIDATION': eventValidation,
          '__ASYNCPOST': true,
          'ctl00$ContentPlaceHolder1$mainTab$mainTab1$btn_GoPageNo': 'Go'
         });
    var requestParmPartial = {method: 'POST', data: data};
    requestParm = $j.extend({}, requestParmShared, requestParmPartial);
  } else {
    var requestParmFull = {method: 'GET'};
    requestParm = $j.extend({}, requestParmShared, requestParmFull);
  }

  ajaxRequest = GM_xmlhttpRequest(requestParm);

  // Specical handling for TamperMonkey
  if(typeof(TM_xmlhttpRequest) !== 'undefined') {
    timeoutRequest(function() {handleTamperMonkeyTimeout(handleTimeout);});
  }
}

// Handle data response
replaceContent = function(response) {
  clearMessage();
  var data = response.responseText;
  var history;

  if(!data || (data.length === 0)
      || (data.indexOf('ctl00_ContentPlaceHolder1_mainTab_mainTab1_UpdatePanelHistory') === -1)) {
    // No history in data response
    return false;
  }

  var partialResponse = (data.indexOf('<!DOCTYPE html') === -1);

  if(partialResponse) {
    // Find history and viewState in partial response
    var startPos = data.indexOf('<div');
    var endPos = data.lastIndexOf('/table>');
    if(startPos >= 0 && endPos >= 0) {
      endPos = endPos + '/table>'.length;
      history = $j('<div></div>').html(data.slice(startPos, endPos));
      viewState = data.match(/\|__VIEWSTATE\|.*?\|/gm)[0].replace(/\|__VIEWSTATE\|/gm, '').replace(/\|/gm, '') || viewState;
      eventValidation = data.match(/\|__EVENTVALIDATION\|.*?\|/gm)[0].replace(/\|__EVENTVALIDATION\|/gm, '').replace(/\|/gm, '') || eventValidation;
    }
  } else {
    // Find history and viewState in full response
    $j.each($j.parseHTML(data), function(i, el) {
      if(el.id === 'aspnetForm') {
        var doms = $j(el);
        viewState = doms.find('#__VIEWSTATE').val();
        eventValidation = doms.find('#__EVENTVALIDATION').val();
        history = doms.find('div#ctl00_ContentPlaceHolder1_mainTab_mainTab1_UpdatePanelHistory');
        return false;
      }
    });
  }

  if(history.length === 0) return false;

  $j('div#lm_history').html(history.html());
  replaceButton();

  console.log(partialResponse ? 'partial request finished' : 'full request finished');
  useFullRequest = false;

  // Change filter to show all post
  if(!partialResponse) {
    window.LM_CHANGE_FILTER_TYPE = 'all';
  }

  return true;
}

// Store values needed for changing page
storeStatus = function() {
  var history = $j('div#lm_history');
  window.LM_CURRENT_PAGE = parseInt(history.find('#lm_PageNoTextBox').val());
  window.LM_FILTER_TYPE = history.find('#lm_filter_type').val();

  GM_setValue('viewstate', viewState);
  GM_setValue('eventvalidation', eventValidation);
  GM_setValue('lm_last_timestamp', (new Date().getTime()).toString());

  storeLocal('lm_change_page', window.LM_CURRENT_PAGE);
  storeLocal('lm_filter_type', window.LM_FILTER_TYPE);

  console.log('lm page: ' + window.LM_CURRENT_PAGE);
}

// Logout if the can't load partial page
logout = function() {

  var message = '登出緊<img src="faces/angel.gif" />';
  changeAndFlashMessage(message);

  console.log('Try to logout');
  var requestUrl = 'http://' + window.location.hostname + '/logout.aspx';

  ajaxRequest = GM_xmlhttpRequest({
    method: 'HEAD',
    url: requestUrl,
    timeout: ajaxTimeout,
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    onload: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        console.log('logged out.');

        needLogin = true;
        initPageFull();
        requestProfilePage();
      },
    onerror: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        console.log('logout failed.');

        setTimeout(logout, 15000);
      },
    ontimeout: handleLogoutTimeout
  });

  // Specical handling for TamperMonkey
  if(typeof(TM_xmlhttpRequest) !== 'undefined') {
    timeoutRequest(function() {handleTamperMonkeyTimeout(handleLogoutTimeout);});
  }
}

// Popup login page in new window if it was logout
popupLoginWindow = function() {
  if(!needLogin) return;
  needLogin = false;

  var message = '登出左, 開左登入晝面比你登入返<img src="faces/angel.gif" />';
  changeAndFlashMessage(message);

  var Url = 'http://' + window.location.hostname + '/login.aspx';
  var loginWindow = window.open(Url, 'hkg_login')
  setTimeout(function() {checkPopupLogined(loginWindow)}, 200);
}

// Check login popup window status and close it if logined 
checkPopupLogined = function(targetWindow) {
  try {
    var logoutLink = $j(targetWindow.document).find('a[href="javascript:islogout();"]');
    if(logoutLink.length !== 0) {
      console.log('popup logined');
      targetWindow.close();

      clearMessage();
    } else {
      setTimeout(function() {checkPopupLogined(targetWindow)}, 200);
    }
  } catch(err) {
    // Chrome only
    if(err.name == 'SecurityError')
    {
      console.log(err);
      setTimeout(function() {checkPopupLogined(targetWindow)}, 1000);
      console.log('Wait 1 second to determine user has login or not');
    }
  }
}

// Can't simply set 'timeout' value in GM_xmlhttpRequest as TamperMonkey do not support it
timeoutRequest = function(callback) {
  clearTimeout(ajaxRequestTimer);
  ajaxRequestTimer = setTimeout(callback, ajaxTimeout);
}

handleTamperMonkeyTimeout = function(callback) {
  if(ajaxRequest && ajaxRequest.abort) {
    ajaxRequest.abort();
    callback();
  }
}

handleTimeout = function() {
  var message = '太慢喇再Load過<img src="faces/sosad.gif" />';

  changeAndFlashMessage(message);
  RetryFullRequest();
}

handleLogoutTimeout = function() {
  console.log('server logout timeout');
  setTimeout(logout, 15000);
}

handleError = function() {
  console.log('server error');
  var message = 'Server 有問題再Load過<img src="faces/sosad.gif" />';

  changeAndFlashMessage(message);
  RetryFullRequest();
}

tooManyRetryError = function() {
  var message = '唔知咩事試過幾次都唔得, 你Reload下啦<img src="faces/sosad.gif" />';

  changeAndFlashMessage(message);
}

RetryFullRequest = function() {
  // Tried partial request a few times, change to full request
  if(!useFullRequest) {
    useFullRequest = true;
    logout();
  } else {
    tooManyRetryError();
  }
}

changeAndFlashMessage = function(message) {
  var messageDiv = $j('div#lm_message');
  messageDiv.html(message);
  flashMessage(messageDiv);
}

clearMessage = function() {
  var messageDiv = $j('div#lm_message');
  messageDiv.html('');
  messageDiv.stop();
}

flashMessage = function(item) {
  item.stop();
  item.animate({"opacity": "0"},50).animate({"opacity": "1"},50, function(){flashMessage(item);});
}

// Change button event, let this script handle page changing
replaceButton = function() {
  var history = $j('div#lm_history');
  history.find('#ctl00_ContentPlaceHolder1_mainTab_mainTab1_btn_Next')
      .attr('id', 'lm_btn_Next')
      .attr('name', 'lm_btn_Next')
      .click(nextPage);
  history.find('#ctl00_ContentPlaceHolder1_mainTab_mainTab1_btn_Previous')
      .attr('id', 'lm_btn_Previous')
      .attr('name', 'lm_btn_Previous')
      .click(previousPage);
  history.find('#ctl00_ContentPlaceHolder1_mainTab_mainTab1_btn_GoPageNo')
      .attr('id', 'lm_btn_GoPageNo')
      .attr('name', 'lm_btn_GoPageNo')
      .click(gotoPage);
  history.find('#ctl00_ContentPlaceHolder1_mainTab_mainTab1_filter_type')
      .attr('id', 'lm_filter_type')
      .attr('name', 'lm_filter_type')
      .attr('onchange', '')
      .change(changeFilter);
  history.find('#ctl00_ContentPlaceHolder1_mainTab_mainTab1_ddl_filter_year')
      .attr('id', 'lm_filter_year')
      .attr('name', 'lm_filter_year')
      .attr('onchange', '');
  history.find('#ctl00_ContentPlaceHolder1_mainTab_mainTab1_PageNoTextBox')
      .attr('id', 'lm_PageNoTextBox')
      .attr('name', 'lm_PageNoTextBox');
}

// Store the target page number in cookie
nextPage = function() {
  var page = window.LM_CURRENT_PAGE + 1;
  storeLocal('lm_change_page', page);
  window.LM_CHANGE_PAGE = page;
  return false;
}

previousPage = function() {
  var page = Math.max(window.LM_CURRENT_PAGE - 1, 1);
  storeLocal('lm_change_page', page);
  window.LM_CHANGE_PAGE = page;
  return false;
}

gotoPage = function() {
  var history = $j('div#lm_history');
  var page = parseInt(history.find('#lm_PageNoTextBox').val());
  storeLocal('lm_change_page', page)
  window.LM_CHANGE_PAGE = page;
  return false;
}

changeFilter = function() {
  var history = $j('div#lm_history');
  var filter = history.find('#lm_filter_type').val();
  storeLocal('lm_filter_type', filter)
  window.LM_CHANGE_FILTER_TYPE = filter;
  return false;
}

storeLocal = function(key, value) {
  if(typeof(value) !== 'undefined' && value !== null) {
    localStorage[key] = JSON.stringify(value);
  } else {
    localStorage.removeItem(key);
  }
}

loadLocal = function(key) {
  var objectJSON = localStorage[key];
  if(!objectJSON) return;
  return JSON.parse(objectJSON);
}

deleteLocal = function(key) {
  localStorage.remoteItem(key);
}

clearOldCookie = function() {
  if(!loadLocal('cookie_cleared')) {
    document.cookie = 'lm_change_page=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    storeLocal('cookie_cleared', true);
  }
}

shuffle = function(arr) {
  for(
    var j, x, i = arr.length; i;
    j = Math.random() * i|0,
    x = arr[--i], arr[i] = arr[j], arr[j] = x
  );
  return arr;
}

setup = function() {
  $j('<div id="lm"></div><br />').insertBefore('div#ctl00_ContentPlaceHolder1_mainTab');
  $j('div#lm').html('<div>起底</div><div id="lm_history"></div>');

  $j('<div id="lm_message"></div>').insertBefore('div#lm');
  var message = 'Load緊呀等陣啦<img src="faces/angel.gif" />';
  changeAndFlashMessage(message);
}

start = function() {
  clearOldCookie();
  var history = $j('div#ctl00_ContentPlaceHolder1_mainTab_mainTab1_UpdatePanelHistory');
  if(history.length === 1) return;

  setup();

  if(initPagePartial()) {
    requestProfilePage(changePage);
  } else {
    logout();
  }
}

start();
