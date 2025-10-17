import { Generator } from "./Generator";
import * as fs from "fs";
import { TemplateGenerator } from "./TemplateGenerator";

class DocGenerator extends Generator {
  templateGenerator: TemplateGenerator;
  
  constructor() {
    super();
    this.templateGenerator = new TemplateGenerator();
  }

  public generate() {
    console.log(`Creating documentation files for ${Generator.config.package}`);
    this.createFileIfNotExists(
      `output/examples/resources/genesyscloud_${Generator.config.package}/resource.tf`
    );
    this.createFileIfNotExists(
      `output/examples/data-sources/genesyscloud_${Generator.config.package}/data-source.tf`
    );
    this.templateGenerator.generate("apis", {
        operations: Generator.config.operations,
    }, true);
    console.log(`Created documentation files for ${Generator.config.package}`);
  }

  private createFileIfNotExists(filePath: string) {
    try {
      // Check if the file already exists
      if (!fs.existsSync(filePath)) {
        // Create the file 
        fs.writeFileSync(filePath, "");
      } 
    } catch (error) {
      console.error(error);
    }
  }
}

export default new DocGenerator();
