import multer from "multer";
import moment from "moment";
import fileSize from "filesize";
import mime from "mime-types"

import { MulterError } from "multer";

import common from "./common.js";
import mongodb from "./mongodb.js";

const mimePatterns = {
	image: /image/,
	video: /video/,
	audio: /audio\//,
	word: /(?:(?:ms-?)word)|(?:word(?:processing))/,
	excel: /excel/,
	openoffice: /open(?:office|doc)/,
	pdf: /pdf/,
	archive: /rar|[/b]zip|compress/,
	file: /.*/,
};

const contentTypeIconMappings = [
	[mimePatterns.image, "image"],
	[mimePatterns.video, "video"],
	[mimePatterns.audio, "audio"],
	[mimePatterns.word, "word"],
	[mimePatterns.excel, "excel"],
	[mimePatterns.openoffice, "openoffice"],
	[mimePatterns.pdf, "pdf"],
	[mimePatterns.archive, "archive"],
	[mimePatterns.file, ""],
];

const filesUploadLimit = 10;
const storage = mongodb.fs.storage;
const upload = multer({ storage }).array("files", filesUploadLimit);

function fileNameToType(fileName) {
	const mimeType = mime.lookup(fileName);
	const generalType = contentTypeIconMappings.find((mapping) => mapping[0].test(mimeType))[1];
	return generalType;
}

const show = async (request, response, next) => {
	try {
		const files = await mongodb.fs.findAllFiles();
		response.render("archive", {
			files: files,
			moment: moment,
			fileSize: fileSize,
			fileNameToType: fileNameToType,
		});
	} catch (error) {
		next(error);
	}
};

const download = async (request, response) => {
	const id = request.params.id;
	const file = await mongodb.fs.findFile(id);
	const readStream = mongodb.fs.openDownloadStream(file._id);
	readStream.pipe(response);
};

const uploadHandler = (request, response, next) => upload(request, response, (error) => {
	if (error instanceof MulterError) {
		return common.clientError(error, request, response, common.serverError, 409,
			`You cannot upload more then ${filesUploadLimit} files at a time -_-`);
	}
	if (error) {
		return common.serverError(error, request, response, common.lastError);
	}
	next();
});

const postUpload = (options) => (request, response, next) => {
	try {
		const filesUploaded = request.files.map((file) => file.filename);
		console.log(`Files uploaded: ${filesUploaded}`);
		response.redirect(options.redirect);
	} catch (error) {
		next(error);
	}
};

const deleteFile = (options) => async (request, response, next = common.serverError) => {
	try {
		const id = request.params.id;
		await mongodb.fs.deleteFile(id);
		response.redirect(options.redirect);
	} catch (error) {
		next(error);
	}
};

export default {
	show,
	download,
	upload: uploadHandler,
	postUpload,
	delete: deleteFile,
};
