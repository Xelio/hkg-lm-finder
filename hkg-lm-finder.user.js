// ==UserScript==
// @name           HKG LM finder
// @namespace      http://github.com/Xelio/
// @version        6.1.1
// @description    HKG LM finder
// @downloadURL    https://github.com/Xelio/hkg-lm-finder/raw/master/hkg-lm-finder.user.js
// @include        http://forum*.hkgolden.com/profilepage.aspx?userid=*
// @include        http://profile.hkgolden.com/profilepage.aspx?userid=*
// @match          http://*.hkgolden.com/profilepage.aspx?userid=*
// @require        http://code.jquery.com/jquery-1.9.1.min.js
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @copyright      2015, Xelio, Peach(Fix of PM, 紅人榜)
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

var servers;
var selectedServer;

var ajaxTimeout = 30000;
var ajaxRequest;
var ajaxRequestTimer;

var changePage;
var changeFilterType;

var MAX_RETRY = 3;
var retryCounter = 0;
var needLogin = false;

var HISTORY_ID = 'ctl00_ContentPlaceHolder1_mp3';
var HISTORY_SELECTOR = 'span#' + HISTORY_ID;
var GetHistory = function(element) { return element.find(HISTORY_SELECTOR).parent().parent().parent(); };

var NEXT_BUTTON_SELECTOR = '#ctl00_ContentPlaceHolder1_nextBtn';
var PREVIOUS_BUTTON_SELECTOR = '#ctl00_ContentPlaceHolder1_previousBtn';
var GO_BUTTON_SELECTOR = '#ctl00_ContentPlaceHolder1_pageGoBtn';
var FILTER_TYPE_SELECTOR = '#ctl00_ContentPlaceHolder1_filter_type';
var FILTER_YEAR_SELECTOR = '#ctl00_ContentPlaceHolder1_ddl_filter_year';
var PAGE_NO_TEXTBOX_SELECTOR = '#ctl00_ContentPlaceHolder1_pageTextBox';
var RED_PEOPLE_POUND_SELECTOR = '#ctl00_ContentPlaceHolder1_mp4';

var WEB_PROXY_URL = 'http://hkg-lm-loader-1.xelio.eu.org/proxy/';
var GetRequestURL = function(page, filter_type) {
  return WEB_PROXY_URL
  		+ selectedServer + '.hkgolden.com/ProfilePage.aspx?userid=' + window.location.href.match(/userid=(\d+)/)[1]
  		+ '&type=history&page=' + (page || 1) + '&yearFilter=3&filterType=' + (filter_type || 'all');
}

// Monitor window.LM_CHANGE_PAGE and window.LM_CHANGE_FILTER_TYPE and fire
// ajax request to change page or filter. 
// Use this monitoring method because page cannot directly call function in 
// Greasemonkey script context. 
pageChangeByAjax = function() {
  if((window.LM_CHANGE_PAGE && window.LM_CHANGE_PAGE !== window.LM_CURRENT_PAGE)
      ||(window.LM_CHANGE_FILTER_TYPE && window.LM_CHANGE_FILTER_TYPE !== window.LM_FILTER_TYPE)) {

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



// request profile page to get history
requestProfilePage = function(page, filter_type) {
  loadingMessage();

  var requestUrl = GetRequestURL(page, filter_type);
  console.log('request url: ' + requestUrl);

  var requestParm = {
    method: 'GET',
    url: requestUrl,
    timeout: ajaxTimeout,
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    onload: function(response) {
        ajaxRequest = null;
        clearTimeout(ajaxRequestTimer);
      
        if(replaceContent(response)) {
          storeStatus();
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
  
  // Specical timout handling for TamperMonkey
  if(typeof(TM_xmlhttpRequest) !== 'undefined') {
    clearTimeout(ajaxRequestTimer);
    ajaxRequestTimer = setTimeout(handleTamperMonkeyTimeout, ajaxTimeout);
  }
  
  console.log('Sending request.');
  ajaxRequest = GM_xmlhttpRequest(requestParm);
}



// Error or timeout handling

// Can't simply set 'timeout' value in GM_xmlhttpRequest as TamperMonkey do not support it
handleTamperMonkeyTimeout = function() {
  if(ajaxRequest && ajaxRequest.abort) {
    ajaxRequest.abort();
    handleTimeout();
  }
}

handleTimeout = function() {
  timeoutMessage();
  RetryRequest();
}

handleError = function() {
  console.log('server error');
  errorMessage();
  RetryRequest();
}

tooManyRetryError = function() {
  tooManyRetryMessage();
}


RetryRequest = function() {
  // Tried partial request a few times, change to full request
  if(retryCounter < MAX_RETRY) {
    retryCounter++;
    selectedServer = servers.pop();
    requestProfilePage();
  } else {
    tooManyRetryError();
  }
}





// Handle data response
replaceContent = function(response) {
  clearMessage();
  var data = response.responseText;
  var history;

  if(!data || (data.length === 0) || (data.indexOf(HISTORY_ID) === -1)) {
    // No history in data response
    return false;
  }

  // Find history in response
  $j.each($j.parseHTML(data), function(i, el) {
    if(el.id === 'aspnetForm') {
      history = GetHistory($j(el));
      return false;
    }
  });
  
  console.log(history);
  
  if(history.length === 0) return false;

  $j('div#lm_history').html(history.html());
  replaceButton();

  console.log('request finished');
  useFullRequest = false;

  return true;
}

// Change button event, let this script handle page changing
replaceButton = function() {
  var history = $j('div#lm_history');
  history.find(NEXT_BUTTON_SELECTOR)
      .attr('id', 'lm_btn_Next')
      .attr('name', 'lm_btn_Next')
      .click(nextPage);
  history.find(PREVIOUS_BUTTON_SELECTOR)
      .attr('id', 'lm_btn_Previous')
      .attr('name', 'lm_btn_Previous')
      .click(previousPage);
  history.find(GO_BUTTON_SELECTOR)
      .attr('id', 'lm_btn_GoPageNo')
      .attr('name', 'lm_btn_GoPageNo')
      .click(gotoPage);
  history.find(FILTER_TYPE_SELECTOR)
      .attr('id', 'lm_filter_type')
      .attr('name', 'lm_filter_type')
      .attr('onchange', '')
      .change(changeFilter);
  history.find(FILTER_YEAR_SELECTOR)
      .remove();
  history.find(PAGE_NO_TEXTBOX_SELECTOR)
      .attr('id', 'lm_PageNoTextBox')
      .attr('name', 'lm_PageNoTextBox');
  
  history.find(RED_PEOPLE_POUND_SELECTOR)
      .remove();
}

// Store values needed for changing page
storeStatus = function() {
  var history = $j('div#lm_history');
  window.LM_CURRENT_PAGE = parseInt(history.find('#lm_PageNoTextBox').val());
  window.LM_FILTER_TYPE = history.find('#lm_filter_type').val();

  GM_setValue('lm_last_timestamp', (new Date().getTime()).toString());

  storeLocal('lm_change_page', window.LM_CURRENT_PAGE);
  storeLocal('lm_filter_type', window.LM_FILTER_TYPE);

  console.log('lm page: ' + window.LM_CURRENT_PAGE);
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





// localStorage related

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



// Status message related
loadingMessage = function() {
  changeAndFlashMessage('Load緊呀等陣啦<img src="faces/angel.gif" />');
}

timeoutMessage = function() {
  changeAndFlashMessage('太慢喇再Load過<img src="faces/sosad.gif" />');
}

errorMessage = function() {
  changeAndFlashMessage('Server 有問題再Load過<img src="faces/sosad.gif" />');
}

tooManyRetryMessage = function() {
  changeAndFlashMessage('唔知咩事試過幾次都唔得, 你Reload下啦<img src="faces/sosad.gif" />');
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



// Helper funcitons

shuffle = function(arr) {
  for(
    var j, x, i = arr.length; i;
    j = Math.random() * i|0,
    x = arr[--i], arr[i] = arr[j], arr[j] = x
  );
  return arr;
}



// Initialization

setupPageElement = function() {
  $j('<div id="lm"></div><br />').insertAfter($j('div#ctl00_ContentPlaceHolder1_ProfileForm').children()[0]);
  $j('div#lm').html('<div>起底</div><div id="lm_history"></div>');

  $j('<div id="lm_message"></div>').insertBefore('div#lm');
  loadingMessage();
}

start = function() {
  servers = $j.map(shuffle([1,2,3,4,5,6,7,8,9,14,15]), function(n, i) {return 'forum' + n;});
  selectedServer = servers.pop();
  var history = $j(HISTORY_SELECTOR);
  if(history.length === 1) return;

  setupPageElement();
  requestProfilePage();
}

start();
