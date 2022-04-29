const show = (request, response, next) => {
	try {
		response.render("index", {
			header: "Welcome to Students!",
			subheader: "Student group queues & notes"
		});
	} catch (error) {
		next(error, request, response);
	}
}

export default {
	show
}
