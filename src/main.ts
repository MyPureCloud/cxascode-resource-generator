// packages
import * as fs from "fs";
import * as path from "path";
import * as fsPromises from "fs/promises";

// types
import { Config } from "./types/Config";

// generators
import SchemaGenerator from "./generators/SchemaGenerator";
import ProxyGenerator from "./generators/ProxyGenerator";
import ResourceGenerator from "./generators/ResourceGenerator";
import DataSourceGenerator from "./generators/DataSourceGenerator";
import { TestGenerator } from "./generators/TestGenerator";
import DocGenerator from "./generators/DocGenerator";
import readConfig from "./utils/readConfig";

export default async function main() {
  // Read config file
  const configFile = process.env.npm_config_config;
  if (configFile === "true"){
    throw new Error("No config file specified");
  }
  const config: Config = readConfig(configFile);

  // Create output folders if they don't exist
  createFolderIfNotExists("output");
  createFolderIfNotExists("output/genesyscloud/");
  createFolderIfNotExists(`output/genesyscloud/${config.package}`);

  // delete all files in package folder
  await deleteFolderContent(`output/genesyscloud/${config.package}`);

  if (!config.noSchemaFile) {
    // Generate schema file
    SchemaGenerator.generate();
  }

  if (!config.noProxyFile) {
    // Generate proxy file
    ProxyGenerator.generate();
  }

  if (!config.noResourceFile) {
    // Generate resource file
    ResourceGenerator.generate();
  }

  if (!config.noDataSourceFile && config.operations?.find((op) => op.type === "getAll")) {
    // Generate data source file
    DataSourceGenerator.generate();
  }

  // Generate test files
  const testGenerator = new TestGenerator(config.testFiles, config.initTest);
  testGenerator.generate();

  if (config.documentation) {
    createFolderIfNotExists(
      `output/examples/`
    );
    createFolderIfNotExists(
      `output/examples/resources/`
    );
    createFolderIfNotExists(
      `output/examples/data-sources/`
    );
    createFolderIfNotExists(
      `output/examples/resources/genesyscloud_${config.package}`
    );
    createFolderIfNotExists(
      `output/examples/data-sources/genesyscloud_${config.package}`
    );

    // Generate documentation files
    DocGenerator.generate();
  }

  function createFolderIfNotExists(folderPath: string) {
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteFolderContent(folderPath: string) {
    try {
      const files = await fsPromises.readdir(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = await fsPromises.lstat(filePath);

        if (stat.isDirectory()) {
          // Recursively delete subfolder content
          await deleteFolderContent(filePath);
          // Remove the empty directory
          await fsPromises.rmdir(filePath);
        } else {
          // Delete file
          await fsPromises.unlink(filePath);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
}
