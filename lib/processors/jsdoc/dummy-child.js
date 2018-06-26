console.log('child executing');
setTimeout(function() {
	console.log("child done");
	//process.exit(0);
},20000);
