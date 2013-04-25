// ==UserScript==
// @name           HKG LM finder
// @namespace      http://github.com/Xelio/
// @version        1.0.1
// @description    HKG LM finder
// @include        http://forum*.hkgolden.com/ProfilePage.aspx?userid=*
// @match          http://*.hkgolden.com/ProfilePage.aspx?userid=*
// @require        http://code.jquery.com/jquery-1.9.1.min.js
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
var viewStateOutdate = 15 * 60 * 1000;
var lmServer;
var viewState;
var changePage;

var logoutCount = 0;

// Init options for full page loading
initPageFull = function() {
  // Randomly choose a server other than the server which user is currently using
  var currentServer = parseInt(window.location.href.match(/forum(\d+)/)[1]);
  var availableServer = $j.grep(servers, function(value) { return value != currentServer });
  lmServer = availableServer[Math.floor(Math.random()*availableServer.length)];
}

requestPageFull = function() {
  if(logoutCount > 1) initPageFull();
  if(logoutCount > 4) {
    handleError();
    return;
  }

  var requestUrl = window.location.href.replace(/forum\d/, 'forum' + lmServer);
  $j.ajax({
    url: requestUrl,
    type: 'GET',
    cache: false,
    dataType: 'html',
    success: replaceContent,
    error: handleError,
    complete: storeStatus
  });
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
  var requestUrl = window.location.href.replace(/forum\d/, 'forum' + lmServer);
  var data = {
          'ctl00$ScriptManager1': 'ctl00$ScriptManager1|ctl00$ContentPlaceHolder1$btn_GoPageNo',
          'ctl00_ContentPlaceHolder1_tc_Profile_ClientState': '{"ActiveTabIndex":0,"TabState":[true,true,true]}',
          '__VIEWSTATE': viewState,
          'ctl00$ContentPlaceHolder1$ddl_filter_year': 1,
          'ctl00$ContentPlaceHolder1$PageNoTextBox': page,
          '__ASYNCPOST': true,
               'ctl00$ContentPlaceHolder1$btn_GoPageNo': 'Go'
             }
  $j.ajax({
    url: requestUrl,
    type: 'POST',
    cache: false,
    data: data,
    dataType: 'html',
    success: replacePartialContent,
    error: handleError,
    complete: storeStatus
  });
}

// Store values needed for changing page
storeStatus = function() {
  window.LM_CURRENT_PAGE = $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_PageNoTextBox').val();
  GM_setValue('lm_server', lmServer);
  GM_setValue('viewstate', viewState);
  GM_setValue('lm_last_timestamp', new Date().getTime());

  document.cookie = 'lm_change_page=' + window.LM_CURRENT_PAGE;

  console.log('lm server: ' + lmServer);
  console.log('lm page: ' + window.LM_CURRENT_PAGE);
}

// Search LM data in full page and insert
replaceContent = function(data) {
  if(!data || data.length === 0) {
    handleError();
    return;
  }

  var html = $j.parseHTML(data);
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
    logoutCount = 0;
    console.log('full request finished');
  } else {
    logout();
    return;
  }
}

// Search LM data in partial page and insert
replacePartialContent = function(data) {
  if(!data || data.length === 0) {
    handleError();
    return;
  }

  var startPos = data.indexOf('<div');
  var endPos = data.lastIndexOf('/table>');
  if(startPos < 0 || endPos < 0) return;
  
  endPos = endPos + '/table>'.length;
  var slicedData = data.slice(startPos, endPos);
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory').html(slicedData);
  replaceButton();
  logoutCount = 0;
  console.log('partial request finished');
}

handleError = function() {
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory').html('<div id="message">有問題呀Reload啦[sosad]</div>');
  var message = $('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #message');
  flashMessage(message);
}

// Change button event, let this script handle page changing
replaceButton = function() {
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_btn_Next').click(nextPage);
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_btn_Previous').click(previousPage);
  $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_btn_GoPageNo').click(gotoPage);
}

// Logout if the target server is loged in
logout = function(serverNumber) {
  logoutCount++;
  var requestUrl = 'http://forum' + lmServer + '.hkgolden.com/logout.aspx';
  $j.ajax({
    url: requestUrl,
    type: 'GET',
    cache: false,
    dataType: 'html',
    success: [requestPageFull, function(){console.log('logout server: ' + lmServer)}],
    error: handleError
  });
}

// Store the target page number in cookie
nextPage = function() {
  var page = parseInt(window.LM_CURRENT_PAGE) + 1;
  document.cookie = 'lm_change_page=' + page;
  location.reload();
}

previousPage = function() {
  var page = Math.max(parseInt(window.LM_CURRENT_PAGE) - 1, 1);
  document.cookie = 'lm_change_page=' + page;
  location.reload();
}

gotoPage = function() {
  var page = $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #ctl00_ContentPlaceHolder1_PageNoTextBox').val();
  document.cookie = 'lm_change_page=' + page;
  location.reload();
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
  item.animate({"opacity": "0"},10).animate({"opacity": "1"},10, function(){flashMessage(item);});
}

setup = function() {
  $j('<div id="ctl00_ContentPlaceHolder1_UpdatePanelHistory"><div id="message">Load緊呀等陣啦O:-)</div></div><br />').insertBefore('div#ctl00_ContentPlaceHolder1_UpdatePanelPM');
  var message = $j('div#ctl00_ContentPlaceHolder1_UpdatePanelHistory #message');
  flashMessage(message);
}

$j(document).ready(function() {
  var bookmark = $j('div#ctl00_ContentPlaceHolder1_bookmarkPanel');
  if(bookmark.length === 0) return;

  setup();

  if(initPagePartial()) {
    requestPagePartial(changePage);
  } else {
    initPageFull();
    requestPageFull();
  }
});
