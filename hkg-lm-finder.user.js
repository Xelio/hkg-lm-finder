// ==UserScript==
// @name           HKG LM finder
// @namespace      http://github.com/Xelio/
// @version        1.2.2
// @description    HKG LM finder
// @downloadURL    https://github.com/Xelio/hkg-lm-finder/raw/master/hkg-lm-finder.user.js
// @include        http://forum*.hkgolden.com/ProfilePage.aspx?userid=*
// @match          http://*.hkgolden.com/ProfilePage.aspx?userid=*
// @require        http://code.jquery.com/jquery-1.9.1.min.js
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @copyright      2013, Xelio
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

var servers = [1,2,3,4,5,6,7,8];
var availableServer;
var viewStateOutdate = 15 * 60 * 1000;
var ajaxTimeout = 15000;
var ajaxRequest;
var ajaxRequestTimer;
var lmServer;
var viewState;
var changePage;

var retriedCount = 0;

// Init options for full page loading
initPageFull = function() {
  // Randomly choose a server other than the server which user is currently using
  var currentServer = parseInt(window.location.href.match(/forum(\d+)/)[1]);
  availableServer = $j.grep(availableServer, function(value) { return value != currentServer });
  lmServer = availableServer[Math.floor(Math.random()*availableServer.length)];
  viewState = null;
}

requestPageFull = function() {
  if(retriedCount > 1) initPageFull();
  if(retriedCount > 10) {
    tooManyRetryError();
    return;
  }

  var message = '試下Server ' + lmServer + ' 先<img src="faces/angel.gif" />';
  changeAndFlashMessage(message);

  retriedCount++;
  var requestUrl = window.location.href.replace(/forum\d+/, 'forum' + lmServer);
  ajaxRequest = GM_xmlhttpRequest({
    method: 'GET',
    url: requestUrl,
    timeout: ajaxTimeout,
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    onload: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        if(replaceContent(response)) storeStatus();
      },
    onerror: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        handleError();
      },
    ontimeout: handleTimeout
  });

  // Specical handling for TamperMonkey
  if(TM_xmlhttpRequest) timeoutRequest();
}

// Init options for partial page loading
initPagePartial = function() {
  lmServer = GM_getValue('lm_server');
  viewState = GM_getValue('viewstate');
  changePage = getCookie('lm_change_page') || 1;

  // viewState may outdated, so change to full page loading if viewState is too old
  var currTimestamp = new Date().getTime();
  var timediff = currTimestamp - GM_getValue('lm_last_timestamp', currTimestamp);

  if(!lmServer || !viewState || !changePage || timediff > viewStateOutdate) return false;
  return true;
}

requestPagePartial = function(page) {
  var message = '試下Server ' + lmServer + ' 先<img src="faces/angel.gif" />';
  changeAndFlashMessage(message);

  var requestUrl = window.location.href.replace(/forum\d+/, 'forum' + lmServer);
  var data = $j.param({
          'ctl00$ScriptManager1': 'ctl00$ScriptManager1|ctl00$ContentPlaceHolder1$btn_GoPageNo',
          'ctl00_ContentPlaceHolder1_tc_Profile_ClientState': '{"ActiveTabIndex":0,"TabState":[true,true,true]}',
          '__VIEWSTATE': viewState,
          'ctl00$ContentPlaceHolder1$ddl_filter_year': 1,
          'ctl00$ContentPlaceHolder1$PageNoTextBox': page,
          '__ASYNCPOST': true,
               'ctl00$ContentPlaceHolder1$btn_GoPageNo': 'Go'
         });

  ajaxRequest = GM_xmlhttpRequest({
    method: 'POST',
    url: requestUrl,
    data: data,
    timeout: ajaxTimeout,
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    onload: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        if(replacePartialContent(response)) storeStatus();
      },
    onerror: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        handleError();
      },
    ontimeout: handleTimeout
  });

  // Specical handling for TamperMonkey
  if(TM_xmlhttpRequest) timeoutRequest();
}

// Store values needed for changing page
storeStatus = function() {
  window.LM_CURRENT_PAGE = parseInt($j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_PageNoTextBox').val());
  GM_setValue('lm_server', lmServer);
  GM_setValue('viewstate', viewState);
  GM_setValue('lm_last_timestamp', new Date().getTime());

  document.cookie = 'lm_change_page=' + window.LM_CURRENT_PAGE;

  console.log('lm server: ' + lmServer);
  console.log('lm page: ' + window.LM_CURRENT_PAGE);
}

// Search LM data in full page and insert
replaceContent = function(response) {
  if(!response.responseText || response.responseText.length === 0) {
    handleError();
    return false;
  }

  var html = $j.parseHTML(response.responseText);
  var history;
  var bookmark;
  $j.each( html, function( i, el ) {
    if(el.id === 'aspnetForm') {
      var doms = $j(el);
      viewState = doms.find('#__VIEWSTATE').val();
      history = doms.find('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory');
      bookmark = doms.find('div#ctl00_ContentPlaceHolder1_bookmarkPanel');
      return false;
    }
  });

  if(bookmark.length === 0) {
    $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory').html(history.html());
    replaceButton();
    retriedCount = 0;
    console.log('full request finished');
  } else {
    logout();
    return false;
  }
  return true;
}

// Search LM data in partial page and insert
replacePartialContent = function(response) {
  if(!response.responseText || response.responseText.length === 0) {
    handleError();
    return false;
  }
  if(response.responseText.indexOf('<!DOCTYPE html') >= 0) {
    return replaceContent(response);
  }
  if(response.responseText.indexOf('ctl00_ContentPlaceHolder1_UpdatePanelHistory') === -1) {
    handleError();
    return false;
  }

  var startPos = response.responseText.indexOf('<div');
  var endPos = response.responseText.lastIndexOf('/table>');
  if(startPos < 0 || endPos < 0) {
    handleError();
    return false;
  };

  endPos = endPos + '/table>'.length;
  var slicedData = response.responseText.slice(startPos, endPos);
  viewState = response.responseText.match(/\|__VIEWSTATE\|.*?\|/gm)[0].replace(/\|__VIEWSTATE\|/gm, '').replace(/\|/gm, '') || viewState;

  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory').html(slicedData);
  replaceButton();
  retriedCount = 0;
  console.log('partial request finished');
  return true;
}

// Can't simply set 'timeout' value in GM_xmlhttpRequest as TamperMonkey do not support it
timeoutRequest = function() {
  clearTimeout(ajaxRequestTimer);
  ajaxRequestTimer = setTimeout(handleTamperMonkeyTimeout, ajaxTimeout);
}

handleTamperMonkeyTimeout = function() {
  if(ajaxRequest && ajaxRequest.abort) {
    ajaxRequest.abort();
    handleTimeout();
  }
}

handleTimeout = function() {
  console.log('server timeout: ' + lmServer);
  var message = 'Server '+ lmServer +' 太慢喇轉緊第個Server<img src="faces/sosad.gif" />';

  changeAndFlashMessage(message);
  changeServer();
}

handleError = function() {
  var message = 'Server '+ lmServer +' 有問題轉緊第個Server<img src="faces/sosad.gif" />';

  changeAndFlashMessage(message);
  changeServer();
}

tooManyRetryError = function() {
  var message = '唔知咩事試過曬幾個Server都唔得<img src="faces/sosad.gif" />';

  changeAndFlashMessage(message);
}

changeServer = function() {
  availableServer = $j.grep(availableServer, function(value) { return value !== lmServer });
  if(availableServer.length === 0) {
    tooManyRetryError();
    return;
  }
  initPageFull();
  requestPageFull();
}

changeAndFlashMessage = function(message) {
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory').html('<div id="message">'+message+'</div>');
  var messageDiv = $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #message');
  flashMessage(messageDiv);
}

// Change button event, let this script handle page changing
replaceButton = function() {
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_btn_Next').click(nextPage);
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_btn_Previous').click(previousPage);
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_btn_GoPageNo').click(gotoPage);
}

// Logout if the target server is loged in
logout = function(serverNumber) {

  var message = '登出緊Server ' + lmServer + ' <img src="faces/angel.gif" />';
  changeAndFlashMessage(message);

  console.log('Try to logout server '+ lmServer);
  var requestUrl = 'http://forum' + lmServer + '.hkgolden.com/logout.aspx';

  ajaxRequest = GM_xmlhttpRequest({
    method: 'HEAD',
    url: requestUrl,
    timeout: ajaxTimeout,
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    onload: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        console.log('logout server: ' + lmServer); requestPageFull();
      },
    onerror: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
        handleError();
      },
    ontimeout: handleTimeout
  });

  // Specical handling for TamperMonkey
  if(TM_xmlhttpRequest) timeoutRequest();
}

// Store the target page number in cookie
nextPage = function() {
  var page = window.LM_CURRENT_PAGE + 1;
  if(page === window.LM_CURRENT_PAGE) return false;
  document.cookie = 'lm_change_page=' + page;
  location.reload();
  return false;
}

previousPage = function() {
  var page = Math.max(window.LM_CURRENT_PAGE - 1, 1);
  if(page === window.LM_CURRENT_PAGE) return false;
  document.cookie = 'lm_change_page=' + page;
  location.reload();
  return false;
}

gotoPage = function() {
  var page = parseInt($j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_PageNoTextBox').val());
  if(page === window.LM_CURRENT_PAGE) return false;
  document.cookie = 'lm_change_page=' + page;
  location.reload();
  return false;
}

deleteCookie = function(c_name) {
  document.cookie = c_name + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

getCookie = function(c_name) {
  var c_value = document.cookie;
  var c_start = c_value.indexOf(" " + c_name + "=");
  if (c_start == -1) {
    c_start = c_value.indexOf(c_name + "=");
  }
  if (c_start == -1) {
    c_value = null;
  } else {
    c_start = c_value.indexOf("=", c_start) + 1;
    var c_end = c_value.indexOf(";", c_start);
    if (c_end == -1) {
      c_end = c_value.length;
    }
    c_value = unescape(c_value.substring(c_start,c_end));
  }
  return c_value;
}

flashMessage = function(item) {
  item.animate({"opacity": "0"},50).animate({"opacity": "1"},50, function(){flashMessage(item);});
}

setup = function() {
  availableServer = servers;
  $j('<div id="ctl00_ContentPlaceHolder1_UpdatePanelHistory"><div id="message"></div></div><br />').insertBefore('div#ctl00_ContentPlaceHolder1_UpdatePanelPM');

  var message = 'Load緊呀等陣啦<img src="faces/angel.gif" />';
  changeAndFlashMessage(message);
}

start = function() {
  var bookmark = $j('div#ctl00_ContentPlaceHolder1_bookmarkPanel');
  if(bookmark.length === 0) return;

  setup();

  if(initPagePartial()) {
    requestPagePartial(changePage);
  } else {
    initPageFull();
    requestPageFull();
  }
}

start();
