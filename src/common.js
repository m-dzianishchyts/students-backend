import mongodb from "./mongodb.js";

const findSocials = async (request, response, next) => {
	try {
		const socials = await mongodb.socials.findAll();
		response.locals.socials = socials;
		next();
	} catch (error) {
		next(error);
	}
}

const resourceNotFoundError = (request, response, next) => {
	response.status(404).render("error", {
		title: "Error",
		message: "This page is unavailable. Or maybe it never was :/"
	});
}

const serverError = (error, request, response, next) => {
	console.error(error);
	response.status(request.status || 500).render("error", {
		title: "Error",
		message: "We have something broken 0_o. Please try again later."
	});
}

const lastError = (error, request, response, next) => {
	console.error(error);
	const rootFreeError = (({ root, ...other }) => other)(error.view);
	response.status(request.status || 500).json({ error: rootFreeError });
}

const clientError = (error, request, response, next, status, message) => {
	console.log(error);
	response.status(status).render("error", {
		title: "Error",
		message: message
	});
}

export default {
	findSocials,
	clientError,
	resourceNotFoundError,
	serverError,
	lastError,
}