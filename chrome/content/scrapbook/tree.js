
var sbTreeHandler = {

    get TREE() { return document.getElementById("sbTree"); },

    get resource() {
        if ( this.TREE.view.selection.count < 1 ) {
            return null;
        } else {
            return this.TREE.builderView.getResourceAtIndex(this.TREE.currentIndex);
        }
    },

    autoCollapse: false,

    init: function(aFoldersOnly) {
        this.TREE.database.AddDataSource(sbDataSource.data);
        this.autoCollapse = sbCommonUtils.getPref("tree.autoCollapse", false);
        if (aFoldersOnly) {
            document.getElementById("sbTreeRule").setAttribute("iscontainer", true);
        }
        if (this.TREE.getAttribute("data-seltype") == "single") {
            var selType = sbCommonUtils.getPref("ui.sidebarManage", false) ? "multiple" : "single";
            this.TREE.setAttribute("seltype", selType);
        }
        this.TREE.builder.rebuild();
        if (!aFoldersOnly) {
            this.enableDragDrop(true);
        }
    },

    uninit: function() {
        this.enableDragDrop(false);
        var dsEnum = this.TREE.database.GetDataSources();
        while ( dsEnum.hasMoreElements() ) {
            var ds = dsEnum.getNext().QueryInterface(Components.interfaces.nsIRDFDataSource);
            this.TREE.database.RemoveDataSource(ds);
        }
    },

    enableDragDrop: function(aEnable) {
        try {
            this.TREE.builderView.removeObserver(sbTreeDNDObserver);
        }
        catch(ex) {}
        if (aEnable) {
            this.TREE.builderView.addObserver(sbTreeDNDObserver);
        }
    },

    // aType: 0 = folderPicker.xul, 1 = manage.xul, 2 = scrapbook.xul
    onClick: function(aEvent, aType) {
        if ( aEvent.button != 0 && aEvent.button != 1 ) return;
        // "twisty" is the small arrow at the side of a container item
        // click on it toggles the container natively
        var obj = {};
        this.TREE.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, {}, {}, obj);
        if ( !obj.value || obj.value == "twisty" ) return;

        var curIdx = this.TREE.currentIndex;
        var shortcut = sbShortcut.fromEvent(aEvent);
        if (aType == 2 && !sbCommonUtils.getPref("ui.sidebarManage", false)) {
            // non-manage window:
            // simple click to open item; mid-, ctrl-, and shift-click to open in new tab
            // for folders, click or mid-click to toggle
            if (sbDataSource.getProperty(this.resource, "type") != "folder") {
                sbController.open(this.resource, aEvent.button == 1 || shortcut.accelKey || shortcut.shiftKey);
            } else {
                this.toggleFolder(curIdx);
            }
        } else {
            // manage window: mid-click to open in new tab
            if (aEvent.button == 1 && sbDataSource.getProperty(this.resource, "type") != "folder") {
                sbController.open(this.resource, true);
            }
        }
    },

    // simple Enter on container: toggle container (natively)
    onKeyDown: function(aEvent, aType) {
        var shortcut = sbShortcut.fromEvent(aEvent);
        switch (shortcut.keyName) {
            case "Return":
                // Enter to open item; Ctrl/Shift+Enter to open in new tab
                // Enter for non-folder containers will toggle natively
                if ( sbDataSource.getProperty(this.resource, "type") != "folder" ) {
                    sbController.open(this.resource, shortcut.accelKey || shortcut.shiftKey);
                }
                break;
            case "Space":
                // non-manage window:
                // Space to open item; Ctrl/Shift+Space to open in new tab
                if (aType == 2 && !sbCommonUtils.getPref("ui.sidebarManage", false)) {
                    if (sbDataSource.getProperty(this.resource, "type") != "folder") {
                        sbController.open(this.resource, shortcut.accelKey || shortcut.shiftKey);
                    }
                }
                break;
            case "Delete":
                this.remove();
                break;
            case "F2":
                sbController.forward(this.resource, "P");
                break;
        }
    },

    // double click (any button) on container: toggle container (natively)
    onDblClick: function(aEvent, aType) {
        if ( aEvent.originalTarget.localName != "treechildren" || aEvent.button != 0 ) return;
        if ( !(aType < 2 || sbCommonUtils.getPref("ui.sidebarManage", false)) ) return;
        if ( sbDataSource.getProperty(this.resource, "type") == "folder" ) return;
        // manage window:
        // left double click on an item => open
        if ( this.TREE.view.isContainer(this.TREE.currentIndex) ) {
            // toggle the non-folder container to nullify the default toggle behavior
            // (preventDefault doesn't work here)
            this.toggleFolder(this.TREE.currentIndex);
        }
        var shortcut = sbShortcut.fromEvent(aEvent);
        sbController.open(this.resource, shortcut.accelKey || shortcut.shiftKey);
    },

    onDragStart: function(event) {
        if (event.originalTarget.localName != "treechildren") {
            return;
        }
        var resList = this.getSelection(true, 0);
        if (!resList.length) {
            return;
        }
        var dataTransfer = event.dataTransfer;
        dataTransfer.setData("moz/rdfitem", resList.map(function(res){
            return res.Value;
        }).join("\n"));
        dataTransfer.setData("text/x-moz-url", resList.map(function(res){
            return (sbDataSource.getURL(res) || "") + "\n" + sbDataSource.getProperty(res, "title");
        }).join("\n"));
        dataTransfer.setData("text/plain", resList.map(function(res){
            return (sbDataSource.getURL(res) || "");
        }).join("\n"));
        dataTransfer.effectAllowed = "copy,move,link";
    },

    onDragOver: function(event) {
        var dataTransfer = event.dataTransfer;
        // drags items from tree
        if (dataTransfer.types.contains("moz/rdfitem")) {
            event.preventDefault();
        } else if (dataTransfer.types.contains("sb/tradeitem")) {
            if (window.sbManageService) {
                event.preventDefault();
            } else {
                dataTransfer.dropEffect = "none";
            }
        } else if (dataTransfer.types.contains("application/x-moz-tabbrowser-tab") || 
                   dataTransfer.types.contains("text/x-moz-text-internal") || 
                   dataTransfer.types.contains("text/x-moz-url") || 
                   dataTransfer.types.contains("text/_moz_htmlcontext")) {
            event.preventDefault();
            var shortcut = sbShortcut.fromEvent(event);
            if (shortcut.altKey) {
                dataTransfer.dropEffect = "link";
            } else if (sbCommonUtils.getPref("showDetailOnDrop", false) || shortcut.accelKey || shortcut.shiftKey) {
                dataTransfer.dropEffect = "copy";
            }
        } else {
            dataTransfer.dropEffect = "none";
        }
    },

    onDrop: function(row, orient, dataTransfer) {
        // drags items from tree
        if (dataTransfer.types.contains("moz/rdfitem")) {
            this._moveInternal(row, orient, dataTransfer.getData("moz/rdfitem").split("\n"));
            return;
        // drags items from the exported item tree
        } else if (dataTransfer.types.contains("sb/tradeitem")) {
            this._importDataInternal(row, orient, dataTransfer.getData("sb/tradeitem").split("\n"));
            return;
        }
        var ip = this._getInsertionPoint(row, orient);
        var showDetail = dataTransfer.dropEffect == "copy";
        // drags a tab from Firefox
        // => if it's the current tab, capture/bookmark it
        // since Firefox >= 52, dragging a tab gets only "text/x-moz-text-internal" (originally plus "application/x-moz-tabbrowser-tab")
        if (dataTransfer.types.contains("application/x-moz-tabbrowser-tab") || dataTransfer.types.contains("text/x-moz-text-internal")) {
            var tab = dataTransfer.mozGetDataAt("application/x-moz-tabbrowser-tab", 0);
            if (tab instanceof XULElement && tab.localName == "tab" && 
                tab.ownerDocument.defaultView instanceof ChromeWindow && 
                tab == window.top.gBrowser.mCurrentTab) {
                if (dataTransfer.dropEffect == "link") {
                    this._bookmarkInternal(ip, { title: tab.label, source: tab.linkedBrowser.currentURI.spec });
                } else {
                    this._captureInternal(ip, showDetail, false);
                }
            }
        // drags something containing url
        } else if (dataTransfer.types.contains("text/x-moz-url")) {
            var url = dataTransfer.getData("URL");
            // drags a link from the web page content
            // => capture/bookmark it, using the link text as title
            if (dataTransfer.types.contains("text/x-moz-url-desc")) {
                var url = dataTransfer.getData("text/x-moz-url-data");
                var title = dataTransfer.getData("text/x-moz-url-desc");
                if (dataTransfer.dropEffect == "link") {
                    this._bookmarkInternal(ip, { title: title, source: url });
                } else {
                    this._captureLinkInternal(ip, showDetail, url, title);
                }
            // drags Firefox address bar icon
            // => if it's the current tab, capture/bookmark it
            } else if (url == window.top.content.location.href) {
                if (dataTransfer.dropEffect == "link") {
                    this._bookmarkInternal(ip);
                } else {
                    this._captureInternal(ip, showDetail, false);
                }
            // drags files
            // => capture/bookmark the first file
            } else if (dataTransfer.types.contains("Files")) {
                var url = dataTransfer.getData("text/x-moz-url");
                if (dataTransfer.dropEffect == "link") {
                    this._bookmarkInternal(ip, { title: sbCommonUtils.getFileName(url), source: url });
                } else {
                    this._captureFileInternal(ip, showDetail, url);
                }
            // unknown behavior
            // => show error
            } else {
                sbCommonUtils.error(sbCommonUtils.lang("ERROR_INVALID_URL", url));
            }
        // drags rich text from Firefox web page content
        // => capture selection for the current tab or bookmark the current tab
        // @TODO: prevent drag -> switch tab -> drop?
        // => Seems Firefox forbids natively (a drag becomes undroppable if switched tab)
        } else if (dataTransfer.types.contains("text/_moz_htmlcontext")) {
            if (dataTransfer.dropEffect == "link") {
                this._bookmarkInternal(ip);
            } else {
                this._captureInternal(ip, showDetail, true);
            }
        }
    },


    send: function() {
        if ( this.TREE.view.selection.count == 0 ) return;
        var idxList = this.getSelection(false, 0), resList = [], parList = [];
        for ( var i = 0, I = idxList.length; i < I; i++ ) {
            var curRes = this.TREE.builderView.getResourceAtIndex(idxList[i]);
            var parRes = this.getParentResource(idxList[i]);
            if ( parRes.Value == "urn:scrapbook:search" ) {
                parRes = sbDataSource.findParentResource(curRes);
                if (!parRes) { sbCommonUtils.alert(sbCommonUtils.lang("ERR_FAIL_SEND")); return; }
            }
            resList.push(curRes);
            parList.push(parRes);
        }
        sbController.sendInternal(resList, parList);
    },


    copy: function() {
        if ( this.TREE.view.selection.count == 0 ) return;
        var idxList = this.getSelection(false, 0), resList = [], parList = [];
        for ( var i = 0, I = idxList.length; i < I; i++ ) {
            var curRes = this.TREE.builderView.getResourceAtIndex(idxList[i]);
            var parRes = this.getParentResource(idxList[i]);
            if ( parRes.Value == "urn:scrapbook:search" ) {
                parRes = sbDataSource.findParentResource(curRes);
                if (!parRes) { sbCommonUtils.alert(sbCommonUtils.lang("ERR_FAIL_SEND")); return; }
            }
            resList.push(curRes);
            parList.push(parRes);
        }
        sbController.copyInternal(resList, parList);
    },


    remove: function() {
        if ( this.TREE.view.selection.count == 0 ) return;
        var idxList = this.getSelection(false, 0), resList = [], parList = [];
        for ( var i = 0, I = idxList.length; i < I; i++ ) {
            resList.push( this.TREE.builderView.getResourceAtIndex(idxList[i]) );
            parList.push( this.getParentResource(idxList[i]) );
        }
        if ( !sbController.confirmRemovingFor(resList) ) return;
        var rmIDs = sbController.removeInternal(resList, parList, false);
        if ( rmIDs ) {
            sbMainService.trace(sbCommonUtils.lang("ITEMS_REMOVED", rmIDs.length));
            if ( "sbNoteService" in window && sbNoteService.resource && sbNoteService.resource.Value.substring(18,32) == rmIDs[0] ) sbNoteService.exit(false);
        }
    },

    locateInternal: function(aRes) {
        var i = 0;
        var resList = [];
        while ( aRes && aRes.Value != this.TREE.ref && ++i < 32 ) {
            resList.unshift(aRes);
            aRes = sbDataSource.findParentResource(aRes);
        }
        for ( i = 0; i < resList.length; i++ ) {
            var idx = this.TREE.builderView.getIndexOfResource(resList[i]);
            if ( idx != -1 && !this.TREE.view.isContainerOpen(idx) ) this.TREE.view.toggleOpenState(idx);
        }
        this.TREE.treeBoxObject.ensureRowIsVisible(idx);
        this.TREE.view.selection.select(idx);
        this.TREE.focus();
    },


    getParentResource: function(aIdx) {
        var parIdx = this.TREE.builderView.getParentIndex(aIdx);
        if ( parIdx == -1 ) {
            return this.TREE.resource;
        } else {
            return this.TREE.builderView.getResourceAtIndex(parIdx);
        }
    },

    getSelection: function(idx2res, rule) {
        var ret = [];
        for ( var rc = 0; rc < this.TREE.view.selection.getRangeCount(); rc++ ) {
            var start = {}, end = {};
            this.TREE.view.selection.getRangeAt(rc, start, end);
            for ( var i = start.value; i <= end.value; i++ ) {
                if ( rule == 1 && !this.TREE.view.isContainer(i) ) continue;
                if ( rule == 2 && this.TREE.view.isContainer(i) ) continue;
                ret.push( idx2res ? this.TREE.builderView.getResourceAtIndex(i) : i );
            }
        }
        return ret;
    },

    // modify current list so that items in a selected container are all considered selected
    getComplexSelection: function(resList, rule) {
        var ret = [];
        var uriHash = {};
        resList.forEach(function(res){
            if ( sbDataSource.isContainer(res) ) {
                sbDataSource.flattenResources(res, rule, true).forEach(function(childRes){
                    if (!uriHash[childRes.Value]) {
                        ret.push(childRes);
                        uriHash[childRes.Value] = true;
                    }
                });
            } else {
                if (!uriHash[res.Value]) {
                    ret.push(res);
                    uriHash[res.Value] = true;
                }
            }
        });
        return ret;
    },


    toggleFolder: function(aIdx) {
        if ( !aIdx ) aIdx = this.TREE.currentIndex;
        this.TREE.view.toggleOpenState(aIdx);
        if ( this.autoCollapse ) this.collapseFoldersBut(aIdx);
    },

    toggleAllFolders: function(forceClose) {
        var willOpen = true;
        for ( var i = 0; i < this.TREE.view.rowCount; i++ ) {
            if ( !this.TREE.view.isContainer(i) ) continue;
            if ( this.TREE.view.isContainerOpen(i) ) { willOpen = false; break; }
        }
        if ( forceClose ) willOpen = false;
        if ( willOpen ) {
            for ( var i = 0; i < this.TREE.view.rowCount; i++ ) {
                if ( this.TREE.view.isContainer(i) && !this.TREE.view.isContainerOpen(i) ) this.TREE.view.toggleOpenState(i);
            }
        } else {
            for ( var i = this.TREE.view.rowCount - 1; i >= 0; i-- ) {
                if ( this.TREE.view.isContainer(i) && this.TREE.view.isContainerOpen(i) ) this.TREE.view.toggleOpenState(i);
            }
        }
    },

    collapseFoldersBut: function(curIdx) {
        var ascIdxList = {};
        ascIdxList[curIdx] = true;
        while ( curIdx >= 0 ) {
            curIdx = this.TREE.builderView.getParentIndex(curIdx);
            ascIdxList[curIdx] = true;
        }
        for ( var i = this.TREE.view.rowCount - 1; i >= 0; i-- ) {
            if ( !ascIdxList[i] && this.TREE.view.isContainer(i) && this.TREE.view.isContainerOpen(i) ) {
                this.TREE.view.toggleOpenState(i);
            }
        }
    },
    
    // orient: -1 = drop before; 0 = drop on; 1 = drop after
    _moveInternal: function(row, orient, resValueList) {
        if (orient == 1) resValueList.reverse();
        var tarRes = this.TREE.builderView.getResourceAtIndex(row);
        var tarPar = (orient == 0) ? tarRes : this.getParentResource(row);
        if (orient == 1 &&
            this.TREE.view.isContainer(row) &&
            this.TREE.view.isContainerOpen(row) &&
            this.TREE.view.isContainerEmpty(row) == false) {
            tarPar = tarRes;
        }
        resValueList.forEach(function(resValue){
            var curRes = sbCommonUtils.RDF.GetResource(resValue);
            var curAbsIdx = this.TREE.builderView.getIndexOfResource(curRes);
            // if curRes is not visible (dropping to another window where a dragged item is not visible in)
            // use CPU consuming sbDataSource.findParentResource to get parent
            var curPar = (curAbsIdx >= 0) ? this.getParentResource(curAbsIdx) : sbDataSource.findParentResource(curRes);
            var curRelIdx = sbDataSource.getRelativeIndex(curPar, curRes);
            var tarRelIdx = sbDataSource.getRelativeIndex(tarPar, tarRes);
            // if moving to self, skip
            if (curRes.Value == tarRes.Value) return;
            // if tarRes = tarPar, insert to first
            if (orient == 1) {
                (tarRelIdx == -1) ? tarRelIdx = 1 : tarRelIdx++;
            }
            if (orient == -1 || orient == 1) {
                // if moving forward, subtract self (because we'll insert after remove)
                if (curPar.Value == tarPar.Value && tarRelIdx > curRelIdx)
                    tarRelIdx--;
                // if moving to same position, skip
                if (curPar.Value == tarPar.Value && curRelIdx == tarRelIdx)
                    return;
            }
            // Prevent moving curRes to its child.
            // - if curRes is invisible, then its child must be invisible and is impossible to be the target
            // - if curRes is not a container then it must not have a child
            if (curAbsIdx != -1 && this.TREE.view.isContainer(curAbsIdx)) {
                var tmpRes = tarRes;
                var tmpIdx = this.TREE.builderView.getIndexOfResource(tmpRes);
                while (tmpRes.Value != this.TREE.ref && tmpIdx != -1) {
                    tmpRes = this.getParentResource(tmpIdx);
                    tmpIdx = this.TREE.builderView.getIndexOfResource(tmpRes);
                    if (tmpRes.Value == curRes.Value) {
                        return;
                    }
                }
            }
            sbDataSource.moveItem(curRes, curPar, tarPar, tarRelIdx);
        }, this);
        sbCommonUtils.rebuildGlobal();
    },

    _importDataInternal: function(row, orient, idxList) {
        var win = window.top.document.getElementById("sbRightPaneBrowser").contentWindow;
        win.sbImportService.importFromIndexList(row, orient, idxList);
    },

    _captureInternal: function(ip, showDetail, partial) {
        var targetWindow = partial ? sbCommonUtils.getFocusedWindow() : window.top.content;
        window.top.sbContentSaver.captureWindow(
            targetWindow, partial, showDetail, ip[0], ip[1], null, "capture", null
        );
    },

    _captureFileInternal: function(ip, showDetail, url) {
        window.top.sbContentSaver.captureFile(
            url, "file://", "file", showDetail, ip[0], ip[1], null, "link"
        );
    },

    _captureLinkInternal: function(ip, showDetail, url, title) {
        var win = sbCommonUtils.getFocusedWindow();
        var data = {
            urls: [url],
            refUrl: win.location.href,
            showDetail: showDetail,
            resName: ip[0],
            resIdx: ip[1],
            titles: [title],
            context: "link",
        };
        window.top.openDialog(
            "chrome://scrapbook/content/capture.xul", "", "chrome,centerscreen,all,resizable,dialog=no",
            data
        );
    },

    _bookmarkInternal: function(ip, preset) {
        window.top.sbBrowserOverlay.bookmark(ip[0], ip[1], preset);
    },

    _getInsertionPoint: function(aRow, aOrient) {
        if (aRow == -1 || aRow == -128) {
            return [this.TREE.ref, 0];
        }
        var tarRes = this.TREE.builderView.getResourceAtIndex(aRow);
        var tarPar = (aOrient == 0) ? tarRes : this.getParentResource(aRow);
        var tarRelIdx = sbDataSource.getRelativeIndex(tarPar, tarRes);
        if (aOrient == 1)
            tarRelIdx++;
        if (aOrient == 1 &&
            this.TREE.view.isContainer(aRow) &&
            this.TREE.view.isContainerOpen(aRow) &&
            this.TREE.view.isContainerEmpty(aRow) == false) {
            sbMainService.trace("drop after open container");
            tarPar = tarRes; tarRelIdx = 1;
        }
        return [tarPar.Value, tarRelIdx];
    },
};

var sbTreeDNDObserver = {
    canDrop: function(row, orient, dataTransfer) {
        return true;
    },

    onDrop: function(row, orient, dataTransfer) {
        return sbTreeHandler.onDrop(row, orient, dataTransfer);
    },

    onToggleOpenState: function(index) {},
    onCycleHeader: function(colID, elt) {},
    onCycleCell: function(row, colID) {},
    onSelectionChanged: function() {},
    onPerformAction: function(action) {},
    onPerformActionOnRow: function(action, row) {},
    onPerformActionOnCell: function(action, row, colID) {},
};
