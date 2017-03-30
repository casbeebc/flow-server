var g_plotHandler = null;
var g_xData = null;
var g_yData = null;
var g_sequenceName = null;


// initialize the plotter view
function initPlotter() {
	if (g_plotHandler === null) {
		var canvas = document.getElementById('canvas');
		g_plotHandler = createPlotHandler(canvas);
	}
}


// close the plotter screen and go back to the diagram editor
function closePlotter() {
	showDiagramEditor();
}


// add a sequence to be displayed in the plotter screen
function addSequence(sequenceName) {
	g_sequenceName = sequenceName;

	// handle sequence history data received from server
	var handler = function(data) {
		var values = data.values;
		var timestamps = data.timestamps;

		// make sure all values are numeric (or null)
		// fix(faster): do on server
		var len = values.length;
		for (var i = 0; i < len; i++) {
			var val = values[i];
			if (val !== null) {
				values[i] = +val;  // convert to number
			}
		}

		// create plot using manyplot library
		g_xData = createDataColumn('timestamp', timestamps);
		g_xData.type = 'timestamp';
		g_yData = createDataColumn('value', values);
		g_yData.name = sequenceName;
		var dataPairs = [
			{
				'xData': g_xData,
				'yData': g_yData,
			}
		];
		g_plotHandler.plotter.setData(dataPairs);
		g_plotHandler.drawPlot(null, null);

	}

	var updateHandler = function(timestamp, params) {
		console.log('sequence: ' + params['name'] + ', value: ' + params['value']);
		var unixTimestamp = timestamp.unix();
		var value = params['value'];

		// update plot
		g_xData.data.push(unixTimestamp);
		g_yData.data.push(value);
		g_plotHandler.plotter.autoBounds();
		g_plotHandler.drawPlot(null, null);
	}

	// request sequence history data from server
	var url = '/api/v1/resources' + g_controller.path + '/' + sequenceName;
	var params = {
		count: 10000,
	}
	$.get(url, params, handler);
	addMessageHandler('sequence_update', updateHandler);

}


// delete all history for this sequence
function deleteSequenceData() {
	modalConfirm({
		title: 'Delete Sequence Data',
		'prompt': 'Are you sure you want to <b>delete all data</b> for sequence <b>' + g_sequenceName + '</b>?',
		yesFunc: function() {
			$.ajax({
				type: 'DELETE',
				url: '/api/v1/resources' + g_controller.path + '/' + g_sequenceName,
				data: {
					'csrf_token': g_csrfToken,
					'data_only': 1,
				},
				success: function() {
					closePlotter();  // fix(later): just remove/clear this sequence
				},
			});
		}
	});
}
