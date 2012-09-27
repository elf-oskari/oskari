/**
 * @class Oskari.mapframework.mapmodule.GetInfoPlugin
 */
Oskari.clazz.define('Oskari.mapframework.mapmodule.GetInfoPlugin',

/**
 * @method create called automatically on construction
 * @static
 */
function() {
    this.mapModule = null;
    this.pluginName = null;
    this._sandbox = null;
    this._map = null;
    this.enabled = true;
    this.infoboxId = 'getinforesult';
    this.__gfiRequests = [];
}, {
    /** @static @property __name plugin name */
    __name : 'GetInfoPlugin',

    /**
     * @method getName
     * @return {String} plugin name
     */
    getName : function() {
        return this.pluginName;
    },
    /**
     * @method getMapModule
     * @return {Oskari.mapframework.ui.module.common.MapModule}
     * reference to map
     * module
     */
    getMapModule : function() {
        return this.mapModule;
    },
    /**
     * @method setMapModule
     * @param {Oskari.mapframework.ui.module.common.MapModule}
     * reference to map
     * module
     */
    setMapModule : function(mapModule) {
        this.mapModule = mapModule;
        if (mapModule) {
            this.pluginName = mapModule.getName() + this.__name;
        }
    },
    /**
     * @method hasUI
     * @return {Boolean} true
     * This plugin has an UI so always returns true
     */
    hasUI : function() {
        return true;
    },
    /**
     * @method init
     *
     * Interface method for the module protocol
     *
     * @param {Oskari.mapframework.sandbox.Sandbox} sandbox
     *          reference to application sandbox
     */
    init : function(sandbox) {
        var me = this;
        
        this._sandbox = sandbox;
        this._sandbox.printDebug("[GetInfoPlugin] init");
        this.getGFIHandler = Oskari.clazz.create('Oskari.mapframework.mapmodule-plugin.getinfo.GetFeatureInfoHandler', me);
    },
    /**
     * @method register
     * Interface method for the plugin protocol
     */
    register : function() {

    },
    /**
     * @method unregister
     * Interface method for the plugin protocol
     */
    unregister : function() {

    },
    /**
     * @method startPlugin
     *
     * Interface method for the plugin protocol
     *
     * @param {Oskari.mapframework.sandbox.Sandbox} sandbox
     *          reference to application sandbox
     */
    startPlugin : function(sandbox) {
        var me = this;
        if (sandbox && sandbox.register) {
            this._sandbox = sandbox;
        }
        this._map = this.getMapModule().getMap();

        this._sandbox.register(this);
        for (p in this.eventHandlers ) {
            this._sandbox.registerForEventByName(this, p);
        }
        this._sandbox.addRequestHandler('MapModulePlugin.GetFeatureInfoRequest', this.getGFIHandler);
        this._sandbox.addRequestHandler('MapModulePlugin.GetFeatureInfoActivationRequest', this.getGFIHandler);
    },
    /**
     * @method stopPlugin
     *
     * Interface method for the plugin protocol
     *
     * @param {Oskari.mapframework.sandbox.Sandbox} sandbox
     *          reference to application sandbox
     */
    stopPlugin : function(sandbox) {
        var me = this;
        // hide infobox if open
        me._closeGfiInfo();

        if (sandbox && sandbox.register) {
            this._sandbox = sandbox;
        }

        for (p in this.eventHandlers ) {
            this._sandbox.unregisterFromEventByName(this, p);
        }
        this._sandbox.unregister(this);
        this._map = null;
        this._sandbox = null;
    },
    /**
     * @method start
     *
     * Interface method for the module protocol
     *
     * @param {Oskari.mapframework.sandbox.Sandbox} sandbox
     *          reference to application sandbox
     */
    start : function(sandbox) {
    },
    /**
     * @method stop
     *
     * Interface method for the module protocol
     *
     * @param {Oskari.mapframework.sandbox.Sandbox} sandbox
     *          reference to application sandbox
     */
    stop : function(sandbox) {
    },
    /**
     * @method setEnabled
     * Enables or disables gfi functionality
     * @param {Boolean} blnEnabled
     *          true to enable, false to disable
     */
    setEnabled : function(blnEnabled) {
        this.enabled = (blnEnabled === true);
        // close existing if disabled
        if(!this.enabled) {
            this._closeGfiInfo();
        }
    },
    /**
     * @property {Object} eventHandlers
     * @static
     */
    eventHandlers : {
        'EscPressedEvent' : function(evt) {
          this._closeGfiInfo();
        },
        'MapClickedEvent' : function(evt) {
            if (!this.enabled) {
                // disabled, do nothing
                return;
            }
            var lonlat = evt.getLonLat();
            var x = evt.getMouseX();
            var y = evt.getMouseY();
            this.handleGetInfo(lonlat, x, y);
        },
        'MapMoveEvent' : function(event) {
            this.abortGfiRequests();
        }
    },
    /**
     * @method onEvent
     * @param {Oskari.mapframework.event.Event} event a Oskari event object
     * Event is handled forwarded to correct #eventHandlers if found or discarded
     * if not.
     */
    onEvent : function(event) {
        var me = this;
        return this.eventHandlers[event.getName()].apply(this, [event]);
    },
    abortGfiRequests : function() {
        this.__gfiRequests.each(function(req) {
                                    req.abort();
                                });
        this.__gfiRequests.length = 0;        
    },
    handleGetInfo : function(lonlat, x, y) {
        var me = this;

        var me = this;
        var ajaxUrl = this._sandbox.getAjaxUrl(); 

        var lon = lonlat.lon;
        var lat = lonlat.lat;
        
        var mapVO = this._sandbox.getMap();
        var selected = this._sandbox.findAllSelectedMapLayers();
        var layerIds = ""
        for (var i = 0; i < selected.length; i++) {
            if (layerIds !== "") {
                layerIds += ",";
            }
            layerIds += selected[i].getId();
        }
        var gfiReqs = this.__gfiRequests;
        var newGfiRequest = jQuery.ajax(
            {
                beforeSend : function(req) {
                    if (req && req.overrideMimeType) {
                        req.overrideMimeType("application/j-son;" +
                                             "charset=UTF-8");
                    }
                    gfiReqs.push(req);
                },
                complete : function(req) {
                    var reqIdx = gfiReqs.indexOf(req);
                    if (reqIdx >= 0) {
                        gfiReqs.splice(reqIdx, 1);
                    }
                },                
                success : function(resp) {
                    if (resp.data && resp.data instanceof Array) {
                        resp.lonlat = lonlat;
                        var parsed = me._parseGfiResponse(resp);
                        if (!parsed) {
                            return;
                        }
                        parsed.popupid = me.infoboxId;
                        parsed.lonlat = lonlat;
                        me._showFeatures(parsed);
                    }
                },
                error : function() {
                    alert("GetInfo failed.");
                },
                data : {
                    layerIds : layerIds,
                    projection : me.mapModule.getProjection(),
                    x : x,
                    y : y,
                    lon : lon,
                    lat : lat,
                    width : mapVO.getWidth(),
                    height : mapVO.getHeight(),
                    bbox : mapVO.getBbox().toBBOX(),
                    zoom : mapVO.getZoom()
                },
                type : 'POST',
                dataType : 'json',
                url : ajaxUrl + 'action_route=GetFeatureInfoWMS'
            }
        );
    },
    /**
     * @method _closeGfiInfo
     * @private
     * Closes the infobox with GFI data
     */
    _closeGfiInfo : function() {
        var rn = "InfoBox.HideInfoBoxRequest";
        var rb = this._sandbox.getRequestBuilder(rn);
        var r = rb(this.infoboxId);
        this._sandbox.request(this, r);
    },
    /**
     * @method _showGfiInfo
     * @private
     * Shows given content in given location using infobox bundle
     * @param {Object[]} content infobox content array
     * @param {OpenLayers.LonLat} lonlat location for the GFI data
     */
    _showGfiInfo : function(content, lonlat) {
        var me = this;
        // send out the request
        var rn = "InfoBox.ShowInfoBoxRequest";
        var rb = this._sandbox.getRequestBuilder(rn);
        var r = rb("getinforesult", "GetInfo Result", content, lonlat, true);
        this._sandbox.request(me, r);
    },
    /**
     * @method _formatResponseForInfobox
     * @private
     * Parses the GFI JSON response to a content array that can be
     * shown with infobox bundle
     * @param {Object} response response from json query
     * @return {Object[]}
     */
    _formatResponseForInfobox : function(response) {
        var content = [];
        if (!response || !response.data) {
            return content;
        }
        var me = this;
        var dataList = [];
        // TODO: fix in serverside!
        if (!response.data.length) {
            // not an array
            dataList.push(response.data);
        } else {
            dataList = response.data;
        }

        for (var ii = 0; ii < dataList.length; ii++) {
            var data = dataList[ii];
            html = me._formatGfiDatum(data);
            if (html != null) {
                content.push({
                    html : html
                });
            }
        }
        return content;
    },

    /**
     * Formats a GFI datum
     *
     * @param datum
     */
    _formatGfiDatum : function(datum) {
        if (!datum.presentationType) {
            return null;
        }
        var html = '';
        var contentType = ( typeof datum.content);
        var hasHtml = false;
        if (contentType == 'string') {
            hasHtml = (datum.content.indexOf('<html>') >= 0);
            hasHtml = hasHtml || (datum.content.indexOf('<HTML>') >= 0);
        }

        if (datum.presentationType == 'JSON' || (datum.content && datum.content.parsed)) {
            html = '<br/><table>';
            var even = false;
            var jsonData = datum.content.parsed;
            for (attr in jsonData) {
                var value = jsonData[attr];
                if (value == null) {
                    continue;
                }
                if ((value.startsWith && value.startsWith('http://')) || (value.indexOf && value.indexOf('http://') == 0)) {
                    // if (value.startsWith('http://')) {
                    // if (value.indexOf('http://') == 0) {
                    value = '<a href="' + value + '" target="_blank">' + value + '</a>';
                }
                html = html + '<tr style="padding: 5px;';
                if (!even) {
                    html = html + ' background-color: #EEEEEE';
                }
                even = !even;
                html = html + '"><td style="padding: 2px">' + attr + '</td><td style="padding: 2px">' + value + '</td></tr>';
            }
            html = html + '</table>';

            //                  } else if ((datum.presentationType == 'TEXT') ||
            // hasHtml) {
        } else {
            // style="overflow:auto"
            html = '<div>' + datum.content + '</div>';
        }
        return html;
    },

    /**
     * converts given array to CSV
     *
     * @param {Object}
     *            array
     */
    arrayToCSV : function(array) {
        var me = this;
        var separatedValues = "";

        for (var i = 0; i < array.length; i++) {
            separatedValues += array[i];
            if (i < array.length - 1) {
                separatedValues += ",";
            }
        }

        return separatedValues;
    },

    /**
     * Flattens a GFI response
     *
     * @param {Object} data     
     */
    _parseGfiResponse : function(resp) {
    	var sandbox = this._sandbox;
        var data = resp.data;
        var coll = [];
        var lonlat = resp.lonlat;
        var title = lonlat.lon + ", " + lonlat.lat;

        var layerCount = resp.layerCount;
        if (layerCount == 0 || data.length == 0 || !( data instanceof Array)) {
            return;
        }

        for (var di = 0; di < data.length; di++) {
            var datum = data[di];
            var layerId = datum.layerId;
            var layer = sandbox.findMapLayerFromSelectedMapLayers(layerId);
            var layerName =  layer ? layer.getName() : '';
            var type = datum.type;

            if (type == "WFS_LAYER") {
                var features = datum.features;
                if (!(features && features.length)) {
                    continue;
                }
                for (var fi = 0; fi < features.length; fi++) {
                    var fea = features[fi];
                    var children = fea.children;
                    if (!(children && children.length)) {
                        continue;
                    }
                    for (var ci = 0; ci < children.length; ci++) {
                        var child = children[ci];
                        var pnimi = child['pnr_PaikanNimi'];
                        if (pnimi && pnimi['pnr:kirjoitusasu']) {
                            title = pnimi['pnr:kirjoitusasu'];
                        }
                        var pretty = this._json2html(child);
                        coll.push({
                        	markup: pretty,
                        	layerId: layerId,
                        	layerName: layerName});
                    }
                }
            } else {
                var pretty = this._formatGfiDatum(datum);
                if (pretty != null) {
                    coll.push({
                        	markup: pretty,
                        	layerId: layerId,
                        	layerName: layerName});
                }
            }
        }
        
        /*
         * returns { fragments: coll, title: title }
         *  
         *  fragments is an array of JSON { markup: '<html-markup>', layerName: 'nameforlayer', layerId: idforlayer } 
         */
        
        return {
            fragments : coll,
            title : title
        };
    },

    _json2html : function(node,layerName) {
        var me = this;
        if (node == null) {
            return '';
        }
        var even = true;
        var html = '<table>';
        for (var key in node) {
            var value = node[key];
            var vType = ( typeof value).toLowerCase();
            var vPres = ''
            switch (vType) {
                case 'string':
                    if (value.startsWith('http://')) {
                        valpres = '<a href="' + value + '" target="_blank">' + value + '</a>';
                    } else {
                        valpres = value;
                    }
                    break;
                case 'undefined':
                    valpres = 'n/a';
                    break;
                case 'boolean':
                    valpres = ( value ? 'true' : 'false');
                    break;
                case 'number':
                    valpres = '' + number + '';
                    break;
                case 'function':
                    valpres = '?';
                    break;
                case 'object':
                    valpres = this._json2html(value);
                    break;
                default:
                    valpres = '';
            }
            even = !even;
            html += '<tr style="padding: 5px;';
            if (even) {
                html += '">';
            } else {
                html += ' background-color: #EEEEEE;">';
            }
            html += '' + '<td style="padding: 2px;">' + key + '</td>';
            html += '' + '<td style="padding: 2px;">' + valpres + '</td>';
            html += '</tr>';
        }
        html += '</table>';
        return html;
    },

    /**
     * Shows multiple features in an infobox
     *
     * @param {Array} data
     */
    _showFeatures : function(data) {
    	
    	/* data is { fragments: coll, title: title } */
    	/* fragments is an array of JSON { markup: '<html-markup>', layerName: 'nameforlayer', layerId: idforlayer } */
        var me = this;
        var content = {};
        content.html = '';
        content.actions = {};
        for (var di = 0; di < data.fragments.length; di++) {
			var fragment =   data.fragments[di]      	
        	var fragmentTitle = fragment.layerName;
        	var fragmentMarkup = fragment.markup;
        	
             content.html += 
               '<div style="background-color: #424343;margin-top: 14px; margin-bottom: 10px;">' + 
                 '<div class="icon-bubble-left" style="color:white;height:15px;">' + 
                    '<div style="vertical-align: middle; padding-top: 2px; padding-right: 4px; text-align:center;float:left;display:inline;"> ' + 
                       /*(di + 1) + */ 
                    '</div><span style="padding-left:32px;">'+
                     fragmentTitle +
                  '</span></div>'+
                '</div>';
                
            content.html += fragmentMarkup;
        }

        var pluginLoc = this.getMapModule().getLocalization('plugin');
        var myLoc = pluginLoc[this.__name];
        data.title = myLoc.title;

        var rn = "InfoBox.ShowInfoBoxRequest";
        var rb = me._sandbox.getRequestBuilder(rn);
        var r = rb(data.popupid, data.title, [content], data.lonlat, true);
        me._sandbox.request(me, r);
    }
}, {
    /**
     * @property {Object} protocol
     * @static
     */
    'protocol' : ["Oskari.mapframework.module.Module", "Oskari.mapframework.ui.module.common.mapmodule.Plugin"]
});
