function email_dialog() {
	var win = Ti.UI.createWindow();

	// initialize to all modes
	win.orientationModes = [
		Titanium.UI.PORTRAIT, Titanium.UI.LANDSCAPE_LEFT, Titanium.UI.LANDSCAPE_RIGHT
	];

	win.addEventListener('open', function () {

		var dialog = Ti.UI.createAlertDialog({
			message: 'Select a picture from gallery and try to send it using Email',
			ok: 'Ok'
		});

		dialog.addEventListener('click', function (e) {
			Titanium.Media.openPhotoGallery({
				allowEditing: true,

				success: function (event) {
					var emailDialog = Titanium.UI.createEmailDialog();
					if (!emailDialog.isSupported()) {
						Ti.UI.createAlertDialog({
							title: 'Error',
							message: 'Email not available'
						}).show();
						return;
					}
					emailDialog.setSubject('Hello from Titanium!');
					emailDialog.setToRecipients(['foo@yahoo.com']);
					emailDialog.setCcRecipients(['bar@yahoo.com']);
					emailDialog.setBccRecipients(['blah@yahoo.com']);

					if (Ti.Platform.name == 'iPhone OS') {
						emailDialog.setMessageBody('<b>Appcelerator Titanium Rocks!</b>å');
						emailDialog.setHtml(true);
						emailDialog.setBarColor('#336699');
					} else {
						emailDialog.setMessageBody('Appcelerator Titanium Rocks!');
					}
					//The attachment does not supported on Tizen yet
					// attach a blob
					emailDialog.addAttachment(event.media);

					if (Ti.Platform.osname != 'tizen') {
						// attach a file
						var f = Ti.Filesystem.getFile(Titanium.Filesystem.resourcesDirectory, 'etc/cricket.wav');
						emailDialog.addAttachment(f);
					}
					//"complete" event does not support on mobileWeb base platform
					emailDialog.addEventListener('complete', function (e) {
						if (e.result == emailDialog.SENT) {
							if (Ti.Platform.osname != 'android' && Ti.Platform.osname != 'tizen') {
								// android doesn't give us useful result codes.
								// it anyway shows a toast.
								Ti.API.info("message was sent");
							}
						} else {
							Ti.API.info("message was not sent. result = " + e.result);
						}
					});
					emailDialog.open();
				},

				error: function (error) {

				},

				cancel: function () {

				}
			});
		});

		dialog.show();
	});

	return win;
};

module.exports = email_dialog;