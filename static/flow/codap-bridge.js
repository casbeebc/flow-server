var CodapBridge = {
	state: codapInterface.getInteractiveState(),
	lastSendAllInputSequences: moment(moment().valueOf()).toISOString(),
	diagram: null,
	promises: [],
	timeEnd: null,
	parentID: null,
	initialize: function() {
		codapInterface.init({
			name: 'DataFlow',
			title: 'Data Flow',
			dimensions: {width: 900, height: 600},
			version: '0.1'
		}).then(function () {
			// Determine if CODAP already has the Data Context we need.
			// If not, create it.
			return codapInterface.sendRequest({
				action:'get',
				resource: 'dataContext[Flow_Data]'
			}, function (iResult, iRequest) {
				if (iResult && !iResult.success) {
					codapInterface.sendRequest({
						action: 'create',
						resource: 'dataContext',
						values: {
							name: "Flow_Data",
							collections: [
								{
									name: 'samples',
									// The parent collection has just one attribute
									attrs: [ {name: "sample", type: 'categorical'} ],
									childAttrName: "sample"
								}
							]
						}});
					}
				}
			);
		}.bind(this));
	},
	
	sendAllInputSequences: function(diagram) {
		var self = this;
		self.diagram = diagram;
		var now = moment().valueOf();
		self.timeEnd = moment(now).toISOString();
		self.promises = [];
		var handleComplete = function() {
			self.lastSendAllInputSequences = end;
		};
		
		var blocksLength = self.diagram.blocks.length;
		var collections = [];
		for (var i = 0; i < blocksLength; ++i) {
			var block = diagram.blocks[i];
			// check if it is an input block
			if(block.inputCount == 0 && block.outputCount > 0 && block.outputType == "n") {
				// Tell CODAP to open a parent case and call sendData when done
				collections.push({
					name: block.name,
					parent: 'samples',
					attrs: [ {name: "seconds", type: "numeric", precision:0}, {name: "number", type: "numeric", precision: 2}],
				});
				
			}
		}
		var promise = codapInterface.sendRequest({
			action: 'create',
			resource: 'dataContext[Flow_Data].collection',
			values: collections
		});
		self.promises.push(promise);
		
		// We keep track of the sampleNumber in interactiveState. If it doesn't exist
		// yet, create it.
		if (self.state.sampleNumber === undefined || self.state.sampleNumber === null) {
			self.state.sampleNumber = 1;
		}

		// Tell CODAP to open a parent case and call sendData when done
		codapInterface.sendRequest({
			action: 'create',
			resource: 'collection[samples].case',
			values: {values: {sample: self.state.sampleNumber}}
		}).then(self.waitOnCreationOfCollections.bind(self));
		
		// increment sample number.
		self.state.sampleNumber++;
	},
	
	waitOnCreationOfCollections: function(data) {
		var self = this;
		self.parentID = data.values[0].id;
		Promise.all(self.promises).then(self.afterAllCollectionsAreCreated.bind(self, self.timeEnd));
	},
	
	afterAllCollectionsAreCreated: function(end) {
		var self = this;
		var blocksLength = self.diagram.blocks.length;
		for (var i = 0; i < blocksLength; ++i) {
			var block = self.diagram.blocks[i];
			if(block.inputCount == 0 && block.outputCount > 0 && block.outputType == "n") {
				
				var emptyFunction = function(){};
				
				getServerSequenceDataByName({
					count: 5000,
					start_timestamp: self.lastSendAllInputSequences,
					end_timestamp: end
				}, block.name, emptyFunction).done(self.createCaseData.bind({parentID: self.parentID, currentBlock: block}));
			}
		}
	},
	
	createCaseData: function(data) {
		var valuesLength = data.values.length;
		var timestamps = data.timestamps;
		var caseValues = [];
		var initialTimeStamp = null;
		var self = this;
		
		for(var j=0; j < valuesLength; ++j) {
			if(initialTimeStamp == null) {
				initialTimeStamp = data.timestamps[j];
			}
			var timestamp =  data.timestamps[j] - initialTimeStamp;
			var seconds = Math.ceil(timestamp);
			/*
			caseValues.push({
				"seconds": parseInt(seconds),
				"number": parseFloat(data.values[j])
			});
			*/
			
			caseValues.push({
				"parent": self.parentID,
				"values": {
					"seconds": parseInt(seconds),
					"number": parseFloat(data.values[j])
				}
			});
			
		}
		var blockName = self.currentBlock.name;
		codapInterface.sendRequest({
			action: 'create',
			resource: 'dataContext[Flow_Data].collection['+blockName+'].case',
			values: caseValues
		});
	},
	
	sendBlockSequence: function(block, start, end) {
		return getServerSequenceData();
	},
	
	// Here is the function that is triggered when the user presses the button
	sendSequence: function (values) {

		// we assume the connection should have been made by the time a button is
		// pressed.
		if(codapInterface.connectionState !== 'active') {
			alert("not running in codap");
			return;
		}

		// This function is called once the parent case is opened
		var sendData = function( iResult ) {
			var tID = iResult.values[0].id;
			for (var i = 0; i < values.length; i++) {  // fix(soon): is it ok to just call these in rapid succession? should wait until each one is done before sending next?
				codapInterface.sendRequest({
					action: 'create',
					resource: 'collection[numbers].case',
					values: {
						parent: tID,
						values: {number: values[i]}
					}
				});
			}
		};

		// We keep track of the sampleNumber in interactiveState. If it doesn't exist
		// yet, create it.
		if (this.state.sampleNumber === undefined || this.state.sampleNumber === null) {
			this.state.sampleNumber = 0;
		}

		// increment sample number.
		this.state.sampleNumber++;

		// Tell CODAP to open a parent case and call sendData when done
		codapInterface.sendRequest( {
			action: 'create',
			resource: 'collection[samples].case',
			values: {values: {sample: this.state.sampleNumber}}
		}).then(sendData);
	}



};
	
	
	
	
	
	
	
	
	
	