define(["Ti/_/declare", "Ti/_/dom", "Ti/_/event", "Ti/_/lang", "Ti/Media", "Ti/_/Evented"],
	function(declare, dom, event, lang, Media, Evented) {
	
	// Ti.Media.AudioPlayer is based on tag <audio> of HTML5.
	//
	// Unlike Ti.Media.Sound, it is suited best for playing non-local files (streams)
	// from the Internet. Although the implementation is similar to Ti.Media.Sound,
	// the interface is different, including callbacks. (For example, unlike Sound,
	// error reporting is lacking in the interface of AudioPlayer.)
	//
	// Ti.Media.AudioPlayer wraps the interface of the <audio> tag, adds basic
	// state management, error checking, and provides interface common for
	// Titanium namespaces.
	
	var doc = document,
		on = require.on,
		mimeTypes = {
			"mp3": "audio/mpeg",
			"ogg": "audio/ogg",
			"wav": "audio/wav"
		},
		BUFFERING = 0,
		INITIALIZED = 1,
		PAUSED = 2,
		PLAYING = 3,
		STARTING = 4,
		STOPPED = 5,
		STOPPING = 6,
		WAITING_FOR_DATA = 7,
		WAITING_FOR_QUEUE = 8,
		ENDED = 9,
		ABORT = 10,
		ERROR = 11;
			
	return declare("Ti.Media.AudioPlayer", Evented, {
		_currentState: STOPPED,
		
		// The "_volume" variable mirror (cache) the according properties of the <audio> tag.
		// Reason: if the <audio> tag is not initialized, direct referencing of the tag's properties
		// leads to exception. To prevent this situation, we mirror the properties and use them
		// if the tag's properties cannot be accessed at the moment.
		_volume: 1.0,
		
		// This variable records the command that was requested before the <audio> tag was initialized.
		// It will be executed when the tag becomes initialized.
		_nextCmd: undefined,
		
		_initialized: false,
		
		constructor: function() {
			this._handles = [];
		},
		properties: {
			url : {
				set: function(value) {
					if (!value || value === this.properties.__values__.url) {
						return;
					}
					this.constants.__values__.playing 	= false;
					this.constants.__values__.paused 	= false;
					this._currentState = STOPPED;
					this.properties.__values__.url = value;
					this._createAudio(true/*Release*/);
					return value;
				}
			},
			
			// See comment for "_volume".
			volume : {
				get: function() {
					return this._volume;
				},
				set: function(value) {
					if (value > 1.0 )
						value = 1.0;
					else if (value < 0)	
						value = 0;
					
					this._volume = value;
					this._initialized && this._audio && (this._audio.volume = value);
					return value;
				}
			},
			
			// NOTE: This property is new. It is proposed for inclusion.
			autoplay: false
		},
		
		//read-only properties
		constants: {
			paused : false,
			playing : false,
			idle : false,
			state: STOPPED,
			progress: 0,
			STATE_BUFFERING:0,
			STATE_INITIALIZED:1,
			STATE_PAUSED:2,
			STATE_PLAYING:3,
			STATE_STARTING:4,
			STATE_STOPPED:5,
			STATE_STOPPING:6,
			STATE_WAITING_FOR_DATA:7,
			STATE_WAITING_FOR_QUEUE:8
		},
		
		//used for delayed command when playback has not initialised yet
		// see comment for "_nextCmd"
		_command: function(cmd) {
			if(!this._initialized) {
				this._nextCmd = cmd
				return true;
			}
			return false;
		},
		
		// Update the state information;
		// fire external events according to changes of the internal state.
		_changeState: function(newState, description) {
			this._currentState = newState;
			this.constants.__values__.playing 	= PLAYING === newState;
			this.constants.__values__.paused 	= PAUSED === newState;
			this.constants.__values__.idle = !this.constants.__values__.playing && this._initialized;
			var evt = {};
			evt['state'] = this.constants.__values__.state = this._currentState;
			evt['src'] = this;
			evt['description'] = description;
			this.fireEvent('change', evt);// external (interface) event
		},
		
		// isRelease: if true, the <audio> tag will be destroyed and recreated.
		// if false, and the tag has been already created, nothing will happen.
		_createAudio: function(isRelease) {
			var audio = this._audio,
			url = this.url,
			i, attr, match;
		
			if (!url) {
				return;
			}
			
			if (audio && audio.parentNode && !isRelease) {
				return audio;
			}
			
			this.release();
			
			audio = this._audio = dom.create("audio");
			
			// Handlers of events generated by the <audio> tag. 
			// These events are handled here and do not propagate outside.
			this._handles = [
				on(audio, "playing", this, function() {this._changeState(PLAYING, "playing");}),
				on(audio, "play", this, function() {this._changeState(STARTING, "starting");}),
				on(audio, "pause", this, function() {
					if (this._currentState === STOPPING) {
						this._stop();
					} else {
						this._changeState(PAUSED, "paused");	
					}
				}),
				
				on(audio, "ended", this, function() {
					//description="ended" because AudioPlayer does not have "ENDED" state 
					this._stop("ended");
				}),
				on(audio, "abort", this, function() {
					//description="abort" because AudioPlayer does not have "ABORT" state 
					this._changeState(STOPPED, "abort");
				}),
				on(audio, "timeupdate", this, function() {
					var curTime = Math.floor(this._audio.currentTime * 1000);
					this.constants.__values__.progress = curTime;
					this.fireEvent( 'progress', {'progress': curTime} );// external (interface) event
					this._currentState === STOPPING && this.pause();
				}),
				on(audio, "error", this, function() {
					// The error event is missing in Titanium API.
					// So we will fire "change" event with state="STOPPED" 
					// and description about error
					var msg = "Unknown error";
					switch (this._audio.error.code) {
						case 1: msg = "Aborted"; break;
						case 2: msg = "Decode error"; break;
						case 3: msg = "Network error"; break;
						case 4: msg = "Unsupported format";break;
					}
					this._changeState(STOPPED, "error: " + msg);
				}),
				on(audio, "canplay", this, function() {
					this._initialized = true;
					
					//Audio has just initilized
					this.volume = this._volume;
					this._changeState(INITIALIZED, "initialized");
					
					//autoplay or delayed command
					if (this.autoplay && this._nextCmd != this.pause && this._nextCmd != stop) {
						audio.play();
					} else if ( this._nextCmd ){
						this._nextCmd();
					}
					
					this._nextCmd = null;
					this.autoplay = false;
				})
			];
			
			doc.body.appendChild(audio);
			
			//Set "url" into tag <source> of tag <audio>
			require.is(url, "Array") || (url = [url]);
			
			for (i = 0; i < url.length; i++) {
				attr = {src: url[i]};
				match = url[i].match(/.+\.([^\/\.]+?)$/);
				match && mimeTypes[match[1]] && (attr.type = mimeTypes[match[1]]);
				dom.create("source", attr, audio);
			}


			return audio;
			
		},
		
		// Remove the <audio> tag from the DOM tree
		release: function() {
			var audio = this._audio,
				parent = audio && audio.parentNode;
			this._currentState = STOPPED;
			this.constants.playing = false;
			this.constants.paused = false;
			if (parent) {
				event.off(this._handles);
				parent.removeChild(audio);
			}
			this._audio = null;
		},
		
		// All methods can be called before initialization <audio> tag
		// It can be reason of crush tag <audio>.  
		// In order to avoid it we add "delayed" functionality
		pause: function() {
			var audio;
			!this._command(this.pause) && this._currentState === PLAYING && (audio = this._createAudio()) && audio.pause();
		},
		
		start: function() {
			var audio;
			!this._command(this.start) && this._currentState !== PLAYING && (audio = this._createAudio()) && audio.play();
		},
		
		play: function() {
			this.start();
		},
		
		_stop: function(description) {
			var a = this._audio;
			a.currentTime = 0;
			this._changeState(STOPPED, description || "stopped");

			// Some versions of Webkit has a bug: if <audio>'s current time is non-zero and we try to 
			// stop it by setting time to 0 and pausing, it won't work: music is paused, but time is 
			// not reset. This is a work around.
			if (a.currentTime !== 0) {
				a.load();
				this.volume = this._volume;
			}
		},
		
		stop: function() {
			if (this._command(this.stop)) {
				return;
			}
			
			var a = this._audio;
			
			if (!a)
				return;
				
			if (this._currentState === PAUSED) {
				this._stop();
			} else {
				this._changeState(STOPPING, "stopping");
				a.pause();
			}
		},
		
		isPaused: function() {
			return this.constants.__values__.paused; 
		},
		
		isPlaying: function() {
			return this.constants.__values__.playing;
		},
		
		stateDescription: function(stateId) {
			var strDescription="";
			switch(stateId){
				case BUFFERING:
					strDescription = "buffering";
					break;
				case INITIALIZED:
					strDescription = "initialized";
					break;
				case PAUSED:
					strDescription = "paused";
					break;
				case PLAYING:
					strDescription = "playing";
					break;	
				case STARTING:
					strDescription = "starting";
					break;
				case STOPPED:
					strDescription = "stopped";
					break;
				case STOPPING:
					strDescription = "stopping";
					break;
				case WAITING_FOR_DATA:
					strDescription = "waiting for data";
					break;
				case WAITING_FOR_QUEUE:
					strDescription = "waiting for queue";
					break;
			}
				
			return strDescription;
		}
	});
});