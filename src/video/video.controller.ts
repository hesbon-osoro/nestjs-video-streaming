import {
	Controller,
	Get,
	Param,
	Res,
	HttpStatus,
	Header,
	Headers,
	NotFoundException,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { existsSync, statSync, createReadStream } from 'fs';
import { join } from 'path';
import { Response } from 'express';

const ASSETS = join(process.cwd(), 'assets');

/** "bytes=start-end" (end optional) as an inclusive byte range within the file, or null if unusable. */
export function parseRange(
	header: string,
	size: number
): { start: number; end: number } | null {
	const m = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
	if (!m) return null;
	const start = parseInt(m[1], 10);
	const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
	if (start >= size || end < start) return null;
	return { start, end };
}

@Controller('video')
export class VideoController {
	constructor(private readonly videoService: VideoService) {}

	@Get('stream/:id')
	@Header('Accept-Ranges', 'bytes')
	@Header('Content-Type', 'video/mp4')
	async getStreamVideo(
		@Param('id') id: string,
		@Headers('range') videoRange: string | undefined,
		@Res() res: Response
	) {
		// Only numeric ids, so a request can never point outside assets/.
		if (!/^\d+$/.test(id)) throw new NotFoundException();
		const videoPath = join(ASSETS, `${id}.mp4`);
		if (!existsSync(videoPath)) throw new NotFoundException();
		const { size } = statSync(videoPath);
		if (videoRange) {
			const range = parseRange(videoRange, size);
			if (!range) {
				res.writeHead(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, {
					'Content-Range': `bytes */${size}`,
				}); //416
				return res.end();
			}
			const { start, end } = range;
			const readStreamfile = createReadStream(videoPath, {
				start,
				end,
				highWaterMark: 60,
			});
			const head = {
				'Content-Range': `bytes ${start}-${end}/${size}`,
				'Content-Length': end - start + 1,
			};
			res.writeHead(HttpStatus.PARTIAL_CONTENT, head); //206
			readStreamfile.pipe(res);
		} else {
			const head = {
				'Content-Length': size,
			};
			res.writeHead(HttpStatus.OK, head); //200
			createReadStream(videoPath).pipe(res);
		}
	}
	@Get()
	findAll() {
		return this.videoService.findAll();
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.videoService.findOne(+id);
	}
}
