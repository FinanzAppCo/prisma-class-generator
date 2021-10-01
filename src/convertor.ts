import { DMMF } from "@prisma/generator-helper";
import { IDecorator, PrismaClass, PrismaField } from "./classes";
import { PrismaClassGeneratorOptions } from "./generator";
import { capitalizeFirst } from "./util";

const primitiveMapType: Record<string, string> = {
  Int: "number",
  String: "string",
  DateTime: "Date",
  Boolean: "boolean",
  Json: "any",
  BigInt: "bigint",
  Float: "number",
  Decimal: "number",
  Bytes: "Buffer",
};

export const extractSwaggerDecoratorFromField = (
  dmmfField: DMMF.Field,
): IDecorator => {
  const apiPropertyParams: Record<string, any> = {};

  let type = primitiveMapType[dmmfField.type];

  // primitive type
  if (type) {
    apiPropertyParams["type"] = capitalizeFirst(type);
    return {
      name: "ApiProperty",
      params: [apiPropertyParams],
    };
  }
  type = dmmfField.type;

  if (dmmfField.isList) {
    apiPropertyParams["isArray"] = true;
  }

  if (dmmfField.relationName) {
    apiPropertyParams["type"] = `() => ${dmmfField.type}`;
    return {
      name: "ApiProperty",
      params: [apiPropertyParams],
    };
  }

  if (dmmfField.kind === "enum") {
    apiPropertyParams["enum"] = dmmfField.type;
    apiPropertyParams["enumName"] = `'${dmmfField.type}'`;
  }

  return {
    name: "ApiProperty",
    params: [apiPropertyParams],
  };
};

export const convertField = (dmmfField: DMMF.Field): PrismaField => {
  const field = new PrismaField({
    name: dmmfField.name,
  });
  let type = primitiveMapType[dmmfField.type];

  // primitive type
  if (type) {
    field.type = type;
    return field;
  }
  type = dmmfField.type;

  if (dmmfField.isList) {
    field.type = type += "[]";
  }

  if (dmmfField.relationName) {
    field.type = `${type}`;
    return field;
  }

  if (dmmfField.kind === "enum") {
    field.type = dmmfField.type;
  }

  return field;
};

export const convertModels = (
  dmmf: DMMF.Document,
  config: PrismaClassGeneratorOptions,
): PrismaClass[] => {
  return dmmf.datamodel.models.map((model) =>
    convertModel({
      model: model,
      config: config,
    }),
  );
};

export const convertModel = (input: {
  model: DMMF.Model;
  config: PrismaClassGeneratorOptions;
}): PrismaClass => {
  const { model, config } = input;
  const { useSwagger } = config;

  const pClass = new PrismaClass({
    name: model.name,
  });

  const fields = model.fields.map((field) => {
    const converted = convertField(field);
    if (useSwagger) {
      const decorator = extractSwaggerDecoratorFromField(field);
      converted.decorators.push(decorator);
    }
    console.dir(converted, { depth: null });
    return converted;
  });

  const relationTypes = model.fields
    .filter((field) => field.relationName && model.name !== field.type)
    .map((v) => v.type);
  const enums = model.fields.filter((field) => field.kind === "enum");

  pClass.fields = fields;
  pClass.relationTypes = [...new Set(relationTypes)];
  pClass.enumTypes = enums.map((field) => field.type);

  pClass.decorators.push({
    name: "ApiExtraModels",
    params: [pClass.name],
  });

  return pClass;
};