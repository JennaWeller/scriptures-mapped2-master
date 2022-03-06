/*
* FILE:     scriptures.js
* AUTHOR:   Jenna Weller
* Date:     Winter 2022
*
* DESCRIPTION: Front-end JavaScript code for The Scriptures, Mapped.
                IS 542, Winter 2022, Byu.
*
*/
/*jslint
    browser, long
*/
/*global console, google, map, window */
/*property
    Animation, DROP, LatLng, Marker, animation, books, color, fontWeight,
    forEach, fullName, gridName, hash, includes, innerHTML, label, lat, lng,
    log, map, maps, maxBookId, minBookId, numChapters, onerror, onload, open,
    parse, position, push, querySelector, responseText, send, setMap, status,
    strokeColor, text, title
*/


const scriptures = (function () {
    "use strict";

    /*---------------------------------------------------------------
    *                       CONSTANTS
    */

   const INDEX_PLACENAME =  2;
   const INDEX_LATITUDE = 3;
   const INDEX_LONGITUDE = 4;
   const INDEX_PLACE_FLAG = 11;
   const LAT_LON_PARSER = /\((.*),'(.*)',(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),'(.*)'\)/;
   const MAX_RETRY_DELAY = 5000;
   const REQUEST_GET = "GET";
   const REQUEST_STATUS_OK = 200;
   const REQUEST_STATUS_ERROR = 400;
   const SCRIPTURES = `<span>
                            <a onclick="changeHash()">The Scriptures</a>
                        </span>`;
   const URL_BASE = "https://scriptures.byu.edu/";
   const URL_BOOKS = `${URL_BASE}mapscrip/model/books.php`;
   const URL_SCRIPTURES = "https://scriptures.byu.edu/mapscrip/mapgetscrip.php";
   const URL_VOLUMES = `${URL_BASE}mapscrip/model/volumes.php`;
   const transitionEnd = 3;

    /*---------------------------------------------------------------
    *                       PRIVATE VARIABLES
    */
    let books;
    let gmMarkers = [];
    let nextChap = false;
    let prevChap = false;
    let retryDelay = 500;
    let transitions = 0;
    let transitioning = false;
    let volumes;

    /*---------------------------------------------------------------
    *                       PRIVATE METHOD DECLARATIONS
    */
   let addMarker;
   let ajax;
   let bookChapterValid;
   let cacheBooks;
   let changeHash;
   let clearMarkers;
   let createBreadCrumb;
   let encodedScriptureUrlParameters;
   let finishTransition;
   let getBook;
   let getChapter;
   let getVolume;
   let getNextCallback;
   let getPreviousCallback;
   let getScriptureCallback;
   let getScriptureFailed;
   let hideSlide;
   let init;
   let navigateBook;
   let navigateChapter;
   let navigateHome;
   let nextChapter;
   let onHashChanged;
   let previousChapter;
   let setupBounds;
   let setupMarkers;
   let showLocation;
   let showSlide;
   let titleForBookChapter;
   

    /*---------------------------------------------------------------
    *                       PRIVATE METHODS
    */

    addMarker = function (placename, latitude, longitude) {
        let duplicates = false;
        let theLatLng = new google.maps.LatLng(latitude, longitude);

        gmMarkers.forEach((marker) => {
            if (Math.abs(marker.position.lat() - theLatLng.lat()) < 0.0000001 && Math.abs(marker.position.lng() - theLatLng.lng()) < 0.0000001) {
                if (!marker.title.includes(placename)) {
                    marker.title += `, ${placename}`;
                }
                duplicates = true;
            }
        });

        if (!duplicates) {

            let marker = new google.maps.Marker({
                animation: google.maps.Animation.DROP,
                position: {lat: latitude, lng: longitude},
                map,
                title: placename,
                label: {
                    color: "#201000",
                    strokeColor: "#fff8f0",
                    fontWeight: "bold",
                    text: placename
                  },
                 
                
            });

            gmMarkers.push(marker);
        }
    };

    ajax = function (url, successCallback, failureCallback, skipParse) {
        let request = new XMLHttpRequest();

        request.open(REQUEST_GET, url, true);
        request.onload = function() {
            if (request.status >= REQUEST_STATUS_OK && request.status < REQUEST_STATUS_ERROR) {
                let data = skipParse ? request.responseText : JSON.parse(request.responseText);

                if (typeof successCallback === "function") {
                    successCallback(data);
                }
            } else {
                if (typeof failureCallback === "function") {
                    failureCallback(request);
                }
            }
        };

        request.onerror = failureCallback;
        request.send();
    };

    bookChapterValid = function(bookId, chapter) {
        let book = books[bookId];

        if (book === undefined || chapter < 0 || chapter > book.numChapters) {
            return false;
        }

        if (chapter === 0 && book.numChapters > 0) {
            return false;
        }

        return true;
    };

    cacheBooks = function (callback) {
        volumes.forEach((volume) => {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.maxBookId) {
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });

        if (typeof callback === "function") {
            callback();
        }
    };

    changeHash = function (volumeId, bookId, chapter) {
        let newHash = "";

        if (volumeId !== undefined) {
            newHash += volumeId;

            if (bookId !== undefined) {
                newHash += `:${bookId}`;

                if (chapter !== undefined) {
                    newHash += `:${chapter}`;
                }
            }
        }

        location.hash = newHash;
    };

    clearMarkers = function () {
        gmMarkers.forEach((marker) => {
            marker.setMap(null);
        });

        gmMarkers = [];
    };

    encodedScriptureUrlParameters = function(bookId, chapter, verses, isJst) {
        if (bookId !== undefined && chapter !== undefined) {
            let options = "";

            if (verses !== undefined) {
                options += verses;
            }

            if (isJst !== undefined && isJst) {
                options += '&jst=JST';
            }

            return `${URL_SCRIPTURES}?book=${bookId}&chap=${chapter}&verses${options}`;
        }
    };

    createBreadCrumb = function(volumeId, bookId, chapter) {
        let breadCrumb = document.querySelector('#crumb');

        breadCrumb.innerHTML = SCRIPTURES;

        if (volumeId) {
            breadCrumb.innerHTML += `&#10045; ${getVolume(volumeId)}`;
        }

        if (bookId) {
            breadCrumb.innerHTML += `&#10045; ${getBook(volumeId, bookId)}`;
        }

        if (chapter) {
            breadCrumb.innerHTML += `&#10045; ${getChapter(volumeId, bookId, chapter)}`;
        }
    };

    getBook = function(volumeId, bookId) {
        let book = books[bookId];
        return `<span>
            <a onclick="changeHash(${volumeId}, ${bookId})">${book.gridName}</a>
        </span>`;
    };

    getChapter = function(chapter) {
        return `<span>
            ${chapter}
        </span>`;
    };

    getVolume = function(volumeId) {
        let volume = volumes[volumeId - 1];
        return `<span>
                    <a onclick="changeHash(${volumeId})">${volume.gridName}</a>
                </span>`;
    };

    getNextCallback = function(chapterHTML) {   
        document.querySelector('#scriptures .chapters .nextChap').innerHTML = chapterHTML;

    };

    getPreviousCallback = function(chapterHTML) {
        document.querySelector('#scriptures .chapters .prevChap').innerHTML = chapterHTML;
    };
    getScriptureCallback = function (chapterHTML) {
        document.querySelector('#scriptures .chapters .currentChap').innerHTML = chapterHTML;
        setupMarkers();
    };

    

    getScriptureFailed = function() {
        console.log("Unable to retrieve chapter content");
    };

    hideSlide = function() {
        document.querySelector('#pageButtons').innerHTML = '';
        document.querySelector('#pageButtons').style.height = 0;
        document.querySelector('#scriptures').style.height = '100%';
    };

    init = function (callback) {
        let booksLoaded = false;
        let volumesLoaded = false;

        ajax(URL_BOOKS, function (data) {
            books = data;
            booksLoaded = true;

            if (volumesLoaded) {
                cacheBooks(callback);
            }
        });

        ajax(URL_VOLUMES, function (data) {
            volumes = data;
            volumesLoaded = true;

            if (booksLoaded) {
                cacheBooks(callback);
            }
        });
    };

    navigateBook = function (bookId) {
        let book = books[bookId];
        hideSlide();
        if (book.numChapters === 0 ) {
            navigateChapter(bookId, 0);
        } else if (book.numChapters === 1) {
            navigateChapter(bookId, 1);
        } else {
            let content = `<div id="scripnav">
                                <div class='volume'>
                                    <h5>${book.fullName}</h5>
                                </div>
                                <div class='books'>`;

            for (let i = 0; i < book.numChapters; i++) {
                content += `<a class='btn chapter' id=${i} href='#${book.parentBookId}:${bookId}:${i + 1}'>${i + 1}</a>`;
            }

            content += '</div></div>';
            document.getElementById('scriptures').innerHTML = content;
        }

        createBreadCrumb(book.parentBookId, bookId);
        nextChap = false;
        prevChap = false;
    };

    navigateChapter = function(bookId, chapter) {
        hideSlide();
        if (bookId !== undefined) {
            let book = books[bookId];
            let volume = volumes[book.parentBookId - 1];

            if (!document.querySelector('.chapters')) {
                document.querySelector('#scriptures').innerHTML = `
                                                            <div class='chapters'>
                                                                <div class='prevChap chap'></div>
                                                                <div class='currentChap chap'></div>
                                                                <div class='nextChap chap'></div>
                                                            </div>`;
            }

            showSlide(bookId, chapter);

            if (!nextChap && !prevChap) {
                ajax(encodedScriptureUrlParameters(bookId, chapter),
                    getScriptureCallback, getScriptureFailed, true);
            }

            if (!nextChap) {
                ajax(encodedScriptureUrlParameters(bookId, chapter + 1),
                    getNextCallback, getScriptureFailed, true);
                nextChap = true;
            }

            if (!prevChap) {
                ajax(encodedScriptureUrlParameters(bookId, chapter - 1),
                    getPreviousCallback, getScriptureFailed, true);
                prevChap = true;
            }
         
            createBreadCrumb(book.parentBookId, bookId, chapter);
        }
    };

    navigateHome = function (volumeId) {
        let content = "<div id='scriptnav'>";
        hideSlide();
        volumes.forEach((volume) => {
            if (volumeId === undefined || volumeId === volume.id) {
                content += `<div class='volume'>
                                <a name='v${volume.id}' >
                                    <h5>${volume.fullName}</h5>
                                </a>
                                <div class='books'>`;
                volume.books.forEach((book) => {
                    content += `<a class='btn' id='${book.id}' href='#${volume.id}:${book.id}'>${book.gridName}</a>`;
                });
                content += `</div>`;
            }
        });
        content += "<br /><br /></div>";
        document.querySelector('#scriptures').innerHTML = content;

        volumeId !== undefined ? createBreadCrumb(volumeId) : createBreadCrumb();
        nextChap = false;
        prevChap = false;
    };

    nextChapter = function(bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter < book.numChapters) {
                return [
                    book.parentBookId,
                    bookId,
                    chapter + 1,
                    titleForBookChapter(book, chapter + 1)
                ];
            }

            let nextBook = books[bookId + 1];

            if (nextBook !== undefined) {
                let nextChapterValue = 0;
                if (nextBook.numChapters > 0) {
                    nextChapterValue = 1;
                }

                return [
                    nextBook.parentBookId,
                    nextBook.id,
                    nextChapterValue,
                    titleForBookChapter(nextBook, nextChapterValue)
                ];
            } else if (nextBook === undefined) {
                let newVolume = volumes[book.parentBookId];
                if (newVolume !== undefined) {
                    nextBook = newVolume.books[0];
                    let nextChapterValue = 0;
                    if (nextBook.numChapters > 0) {
                        nextChapterValue = 1;
                    }

                    return [
                        newVolume.id,
                        nextBook.id,
                        nextChapterValue,
                        titleForBookChapter(nextBook, nextChapterValue)
                    ];
                }
            }
        }
    };

    onHashChanged = function () {
        let ids = [];

        if (location.hash !== "" && location.hash.length > 1) {
            ids = location.hash.substring(1).split(":");
        }

        if (ids.length <= 0) {
            navigateHome();
        } else if (ids.length === 1) {
            let volumeId = Number(ids[0]);

            if (volumeId < volumes[0].id || volumeId > volumes.slice(-1).id) {
                navigateHome();
            } else {
                navigateHome(volumeId);
            }
        } else if (ids.length >= 2) {
            let bookId = Number(ids[1]);

            if (books[bookId] === undefined) {
                navigateHome();
            } else {
                if (ids.length === 2) {
                    navigateBook(bookId);
                } else {
                    let chapter = Number(ids[2]);

                    if (bookChapterValid(bookId, chapter)) {
                        navigateChapter(bookId, chapter)
                    } else {
                        navigateHome();
                    }
                }
            }
        }
    };

    previousChapter = function (bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter > 1) {
                return [
                    book.parentBookId,
                    bookId,
                    chapter - 1,
                    titleForBookChapter(book, chapter - 1)
                ];
            } else {
                let prevBook = books[bookId - 1];

                if (prevBook !== undefined) {
                    return [
                        prevBook.parentBookId,
                        prevBook.id,
                        prevBook.numChapters,
                        titleForBookChapter(prevBook, prevBook.numChapters)
                    ]
                } else if (prevBook === undefined) {
                    let prevVolume = volumes[book.parentBookId - 2];
                    if (prevVolume !== undefined) {
                        prevBook = prevVolume.books[prevVolume.books.length - 1];
                        let prevChapterValue = prevBook.numChapters;

                        return [
                            prevVolume.id,
                            prevBook.id,
                            prevChapterValue,
                            titleForBookChapter(prevBook, prevChapterValue)
                        ];
                    }
                }
            }
        }
    };

    setupBounds = function () {
         // I got this code from https://stackoverflow.com/questions/19304574/center-set-zoom-of-map-to-cover-all-visible-markers
        if (gmMarkers.length === 0) {
            map.setZoom(8);
            map.panTo({lat: 31.7683, lng: 35.2137});
        }

        if(gmMarkers.length === 1) {
            map.setZoom(8);
            map.panTo(gmMarkers[0].position);
        }

        if (gmMarkers.length > 1) {
            let bounds = new google.maps.LatLngBounds();
            gmMarkers.forEach((marker) => {
                bounds.extend(marker.getPosition());
            });

            map.fitBounds(bounds);
        }
    };

    setupMarkers = function () {
        if (window.google === undefined) {

            let retryId = window.setTimeout(setupMarkers, retryDelay);

            retryDelay += retryDelay;
            if (retryDelay > MAX_RETRY_DELAY) {
                window.clearTimeout(retryId);
            }

            return;
        }

        if (gmMarkers.length > 0) {
            clearMarkers();
        }

        document.querySelectorAll('.currentChap a[onclick^="showLocation("]').forEach((el) => {
            let matches = LAT_LON_PARSER.exec(el.getAttribute("onclick"));

            if (matches) {
                let placename = matches[INDEX_PLACENAME];
                let latitude = parseFloat(matches[INDEX_LATITUDE]);
                let longitude = parseFloat(matches[INDEX_LONGITUDE]);
                let flag = matches [INDEX_PLACE_FLAG];

                if  (flag !== "") {
                    placename += " " + flag;
                }

                addMarker(placename, latitude, longitude);
            }
        });

        setupBounds();
    };

    showLocation = function (latitude, longitude, viewAltitude) {
        gmMarkers.forEach((marker) => {
            let theLatLng = new google.maps.LatLng(latitude, longitude);

            if (marker.position.lat() === theLatLng.lat() && marker.position.lng() === theLatLng.lng()) {
                let zoom = Math.round(Number(viewAltitude) / 400);
                6 > zoom ? zoom = 6 : 18 < zoom && (zoom = 15); 
                map.setZoom(zoom);
                map.panTo(marker.position);
            }
        });
    };

    showSlide = function(bookId, chapter) {
        document.querySelector('#pageButtons')
            .innerHTML = `
                            <div id='previous'>
                                <i class="material-icons">
                                navigate_before
                                </i>
                                <span>Back</span>
                            </div>
                            <div id='next'>
                                <span>Next</span>
                                <i class="material-icons">
                                navigate_next
                                </i>
                            </div>
                        `;
        document.querySelector('#pageButtons').style.height = '50px';
        document.querySelector('#scriptures').style.height = 'calc(100% - 50px)';

        document.querySelector('#next').addEventListener('click', () => {
            let next = nextChapter(bookId, chapter);
            let nextChap = nextChapter(next[1], next[2]);

            if (nextChap !== undefined && !transitioning) {
                transitioning = true;
                let previousElement = document.querySelector('.prevChap');
                let currentElement = document.querySelector('.currentChap');
                let nextElement = document.querySelector('.nextChap');

                    previousElement.addEventListener('transitionend', function handler() {
                        previousElement.classList.replace('prevChap', 'nextChap');
                        previousElement.classList.remove('slide');
                        finishTransition(nextChap[1], nextChap[2], getNextCallback);
                        this.removeEventListener('transitionend', handler);
                    });

                    nextElement.addEventListener('transitionend', function handler() {
                        
                        nextElement.classList.replace('nextChap', 'currentChap');
                        nextElement.classList.remove('slide');
                        finishTransition(nextChap[1], nextChap[2], getNextCallback);
                        this.removeEventListener('transitionend', handler);
                    });

                    currentElement.addEventListener('transitionend', function handler() {
                        currentElement.classList.replace('currentChap', 'prevChap');
                        currentElement.classList.remove('slide');
                    finishTransition(nextChap[1], nextChap[2], getNextCallback);
                        this.removeEventListener('transitionend', handler);
                    });

                document.querySelectorAll('.chap').forEach(chap => {
                    chap.classList.add('slide');
                });

                location.hash = `#${next[0]}:${next[1]}:${next[2]}`;
                setupMarkers();
            } else if (!transitioning) {
                navigateHome();
            }
        });

 
        document.querySelector('#previous').addEventListener('click', () => {
            let prev = previousChapter(bookId, chapter);
            let prevChap = previousChapter(prev[1], prev[2]);
            if (prevChap !== undefined && !transitioning) {
                transitioning = true;
                let previousElement = document.querySelector('.prevChap');
                let currentElement = document.querySelector('.currentChap');
                let nextElement = document.querySelector('.nextChap');

                previousElement.addEventListener('transitionend', function handler() {
                    previousElement.classList.replace('prevChap', 'currentChap');
                    previousElement.classList.remove('slideOld');
                    finishTransition(prevChap[1], prevChap[2], getPreviousCallback);
                    this.removeEventListener('transitionend', handler);
                });

                nextElement.addEventListener('transitionend', function handler() {
                    
                    nextElement.classList.replace('nextChap', 'prevChap');
                    nextElement.classList.remove('slideOld');
                    finishTransition(prevChap[1], prevChap[2], getPreviousCallback);
                    this.removeEventListener('transitionend', handler);
                });

                currentElement.addEventListener('transitionend', function handler() {
                    currentElement.classList.replace('currentChap', 'nextChap');
                    currentElement.classList.remove('slideOld');
                    finishTransition(prevChap[1], prevChap[2], getPreviousCallback);
                    this.removeEventListener('transitionend', handler);
                });

                document.querySelectorAll('.chap').forEach(chap => {
                    chap.classList.add('slideOld');
                });
                location.hash = `#${prev[0]}:${prev[1]}:${prev[2]}`;
                setupMarkers();
            } else if (!transitioning){
                navigateHome();
            }
        });
    };

    titleForBookChapter = function (book, chapter) {
        if (chapter > 0){
            return `${book.tocName} ${chapter}`;
        }

        return book.tocName;
    };

    finishTransition = function(book, chapter, ajaxCallback) {
        transitions++;

        if (transitions === transitionEnd) {
            ajax(encodedScriptureUrlParameters(book, chapter),
                        ajaxCallback, getScriptureFailed, true);
            transitions = 0;
            transitioning = false;
        }
    }

    /*---------------------------------------------------------------
    *                       PUBLIC API
    */

    return {
        init,
        changeHash,
        onHashChanged,
        showLocation
    }

}());