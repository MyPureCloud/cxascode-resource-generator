import fs from "fs";

// types
import { Config } from "../types/Config";
import { Swagger, SwaggerSchema } from "../types/Swagger";

import PropertyData from "../classes/PropertyData";
import Resource from "../classes/Resource";
import readSwagger from "../utils/readSwagger";
import readConfig from "../utils/readConfig";

export abstract class Generator {
  // protected properties
  protected static config: Config;
  protected static swagger: Swagger;
  protected static skeltonStructure: boolean;
  protected static parentObject: Resource; // An object representation of the resource

  // private properties
  private ignorableProperties: string[] = [];
  private visitedObjects: string[] = [];

  constructor() {
    // Read config file
    const configFile = process.env.npm_config_config;
    if (configFile === "true") {
      throw new Error("No config file specified");
    }
    Generator.config = readConfig(configFile);

    // Read swagger file
    Generator.swagger = readSwagger();
    if (!Generator.config.operations || Generator.config.skeleton) {
      Generator.skeltonStructure = true;
    }

    // Set ignorable properties
    const properties: string[] = [
      "id",
      "dateCreated",
      "dateModified",
      "version",
      "createdBy",
      "modifiedBy",
      "selfUri",
    ];
    if (Generator.config.ignoreProperties) {
      this.ignorableProperties = [
        ...Generator.config.ignoreProperties,
        ...properties,
      ];
    } else {
      this.ignorableProperties = properties;
    }

    // Generate parent object
    if (!Generator.parentObject) {
      if (
        Generator.swagger.definitions[Generator.config.mainObject] === undefined
      ) {
        throw new Error(
          `Unable to find main object ${Generator.config.mainObject} in swagger file`
        );
      }

      Generator.parentObject = this.setObject(
        Generator.config.mainObject,
        Generator.swagger.definitions[Generator.config.mainObject],
        Generator.config.package
      );
    }

    if (process.env.npm_config_resource === "true") {
      const data = JSON.stringify(Generator.parentObject, null, 2);
      fs.writeFileSync("resource.json", data);
      console.log("Resource object written to resource.json");
      process.exit();
    }
  }

  private setObject(
    name: string,
    object: SwaggerSchema,
    packageName?: string
  ): Resource {
    const required = object.required || [];
    const properties = object.properties;
    const tempObject = new Resource(name, packageName);

    if (properties) {
      for (const [propertyName, property] of Object.entries(properties)) {
        if (this.ignorableProperties.includes(propertyName)) {
          continue;
        }

        const prop = new PropertyData();
        prop.setName(propertyName);
        property.type ? prop.setType(property.type) : prop.setType("object");
        property.description
          ? prop.setDescription(property.description)
          : prop.setDescription("");
        required.includes(propertyName)
          ? prop.setRequired(true)
          : prop.setRequired(false);

        if (prop.getType() === "array") {
          if (property.items?.type === "string") {
            prop.setIsStringArray(true);
          } else if (property.items?.$ref) {
            const objName = property.items?.$ref.split("/")[2]!;

            if (
              objName !== name &&
              this.isValidObject(objName) &&
              !this.visitedObjects.includes(objName)
            ) {
              // Don't handle arrays of references
              if (objName === "DomainEntityRef") {
                prop.setType("unknown");
              } else {
                this.visitedObjects.push(objName);
                prop.setNestedObject(
                  this.setObject(
                    objName,
                    Generator.swagger.definitions[objName]
                  )
                );
              }
            } else if (this.visitedObjects.includes(objName)) {
              const nestedObject = new Resource(objName);
              prop.setNestedObject(nestedObject);
            }
          }
        } else if (prop.getType() === "object") {
          const objName = property.$ref?.split("/")[2]!;

          if (
            objName !== name &&
            this.isValidObject(objName) &&
            !this.visitedObjects.includes(objName)
          ) {
            if (objName === "DomainEntityRef") {
              prop.setType("string");
              prop.setName(prop.getName() + "Id");
              prop.setIsReference(true);
            } else {
              this.visitedObjects.push(objName);
              prop.setNestedObject(
                this.setObject(objName, Generator.swagger.definitions[objName])
              );
            }
          } else if (this.visitedObjects.includes(objName)) {
            const nestedObject = new Resource(objName);
            prop.setNestedObject(nestedObject);
          }
        }
        prop.generateData();

        tempObject.addProperty(prop);
      }
    }

    return tempObject;
  }

  private isValidObject(objectName: string): boolean {
    const object = Generator.swagger.definitions[objectName];
    if (!object) {
      return false;
    }

    if (!object.properties) {
      return false;
    }

    return true;
  }
}
