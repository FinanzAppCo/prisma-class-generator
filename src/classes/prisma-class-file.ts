import { pascalCase } from 'change-case'
import { PrismaClass } from './prisma-class'
import { PrismaImport } from './prisma-import'
import * as fs from 'fs'
import * as path from 'path'
import { log } from '../../src/util'

const getRelativePath = (from: string, to: string): string => {
	let rel = path
		.relative(path.resolve(path.dirname(from)), to)
		.replace('.ts', '')
	if (path.dirname(from) === path.dirname(to)) {
		rel = `./${rel}`
	}
	return rel
}

export class PrismaClassFile {
	private _dir?: string
	private _filename?: string
	private _imports?: PrismaImport[] = []
	private _prismaClass: PrismaClass
	static TEMP_PREFIX = '__TEMPORARY_CLASS_PATH__'
	static PRISMA_CLIENT_PATH
	static ROOT_PATH

	public get dir() {
		return this._dir
	}

	public set dir(value) {
		this._dir = value
	}

	public get filename() {
		return this._filename
	}

	public set filename(value) {
		this._filename = value
	}

	public get imports() {
		return this._imports
	}

	public set imports(value) {
		this._imports = value
	}

	public get prismaClass() {
		return this._prismaClass
	}

	public set prismaClass(value) {
		this._prismaClass = value
	}

	constructor(prismaClass: PrismaClass) {
		this.prismaClass = prismaClass
	}

	echoImports = () => {
		return this.imports
			.reduce((result, importRow) => {
				result.push(importRow.echo())
				return result
			}, [])
			.join('\r\n')
	}

	echo = () => {
		return this.prismaClass
			.echo()
			.replace('#!{IMPORTS}', this.echoImports())
	}

	registerImport(exportedItem: string, from: string) {
		const oldIndex = this.imports.findIndex(
			(_import) => _import.from === from,
		)
		if (oldIndex > -1) {
			this.imports[oldIndex].add(exportedItem)
			return
		}
		this.imports.push(new PrismaImport(from, exportedItem))
	}

	resolveImports() {
		this.prismaClass.relationTypes.forEach((relationClassName) => {
			this.registerImport(
				`${pascalCase(relationClassName)}`,
				PrismaClassFile.TEMP_PREFIX + relationClassName,
			)
		})
		this.prismaClass.enumTypes.forEach((enumName) => {
			const pathToImport = path
				.relative(
					PrismaClassFile.ROOT_PATH,
					PrismaClassFile.PRISMA_CLIENT_PATH,
				)
				.replace('node_modules/', '')
			this.registerImport(enumName, pathToImport)
		})

		this.prismaClass.decorators.forEach((decorator) => {
			this.registerImport(decorator.name, decorator.importFrom)
		})

		this.prismaClass.fields.forEach((field) => {
			field.decorators.forEach((decorator) => {
				this.registerImport(decorator.name, decorator.importFrom)
			})
		})
	}

	write(dryRun: boolean) {
		const targetDirPath = path.resolve(this.dir)
		if (fs.existsSync(targetDirPath) === false) {
			fs.mkdirSync(targetDirPath, { recursive: true })
		}
		const filePath = path.resolve(targetDirPath, this.filename)
		log(`${dryRun ? '[dryRun] ' : ''}Generate ${filePath}`)
		if (dryRun) {
			console.log(this.echo())
			return
		}
		fs.writeFileSync(filePath, this.echo())
	}

	getRelativePath(to: string): string {
		return getRelativePath(this.getPath(), to)
	}

	getPath() {
		return path.resolve(this.dir, this.filename)
	}
}