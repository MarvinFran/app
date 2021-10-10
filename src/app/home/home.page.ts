import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { AlertController, isPlatform, ToastController } from '@ionic/angular';
import write_blob from 'capacitor-blob-writer';
import { PreviewAnyFile } from '@ionic-native/preview-any-file/ngx';

import { File } from '@ionic-native/file/ngx'; /* yo */


const APP_DIRECTORY = Directory.Documents;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  folderContent = [];
  currentFolder = '';
  copyFile = null;
  @ViewChild('filepicker') uploader: ElementRef;

  constructor(private route: ActivatedRoute, private alertCtrl: AlertController, private router: Router,
    private previewAnyFile: PreviewAnyFile, private toastCtrl: ToastController/*yo*/) { }
 
  ngOnInit() {
    this.currentFolder = this.route.snapshot.paramMap.get('folder') || '';
    this.loadDocuments();
  }
 
  async loadDocuments() {
    const folderContent = await Filesystem.readdir({
      directory: APP_DIRECTORY,
      path: this.currentFolder
    });
    // The directory array is just strings
    // We add the information isFile to make life easier
    this.folderContent = folderContent.files.map(file => {
      return {
        name: file,
        isFile: file.includes('.')
      }
    });
  
  }
 
  async createFolder() {
    let alert = await this.alertCtrl.create({
      header: 'Crear folder',
      message: 'Por favor, especifique el nombre del nuevo folder',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Nuevo folder'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Crear',
          handler: async data => {
            await Filesystem.mkdir({
              directory: APP_DIRECTORY,
              path: `${this.currentFolder}/${data.name}`
            });
            this.loadDocuments();
          }
        }
      ]
    });
 
    await alert.present();
  }
 
  addFile() {
    this.uploader.nativeElement.click();
    const aa =     this.uploader.nativeElement.click();
    console.log(this.folderContent[0].name);
   }


 
  async fileSelected($event) {
    const selected = $event.target.files[0];
    
    await write_blob({
      directory: APP_DIRECTORY,
      path: `${this.currentFolder}/${selected.name}`,
      blob: selected,
      on_fallback(error) {
        console.error('error: ', error);
      }
    });

    this.loadDocuments();
   }
 
  async itemClicked(entry) {
    if (this.copyFile) {
      // We can only copy to a folder
      if (entry.isFile) {
        let toast = await this.toastCtrl.create({
          message: 'Please select a folder for your operation'
        });
        await toast.present();
        return;
      }
      this.finishCopyFile(entry);

    }
      else {
      // Open the file or folder
      if (entry.isFile) {
        this.openFile(entry);
      } else {
        let pathToOpen =
          this.currentFolder != '' ? this.currentFolder + '/' + entry.name : entry.name;
        let folder = encodeURIComponent(pathToOpen);
        this.router.navigateByUrl(`/home/${folder}`);
      }
    }
   }
 
  async openFile(entry) {
    if (isPlatform('hybrid')) {
      // Get the URI and use our Cordova plugin for preview
      const file_uri = await Filesystem.getUri({
        directory: APP_DIRECTORY,
        path: this.currentFolder + '/' + entry.name
      });
 
      this.previewAnyFile.preview(file_uri.uri)
        .then((res: any) => console.log(res))
        .catch((error: any) => console.error(error));
    } else {
      // Browser fallback to download the file
      const file = await Filesystem.readFile({
        directory: APP_DIRECTORY,
        path: this.currentFolder + '/' + entry.name
      });
 
      const blob = this.b64toBlob(file.data, '');
      const blobUrl = URL.createObjectURL(blob);
 
      let a = document.createElement('a');
      document.body.appendChild(a);
      a.setAttribute('style', 'display: none');
      a.href = blobUrl;
      a.download = entry.name;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      a.remove();
    }
   }
  b64toBlob = (b64Data, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
 
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
 
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
  }
  

  async delete(entry) { 
    if (entry.isFile) {
      await Filesystem.deleteFile({
        directory: APP_DIRECTORY,
        path: this.currentFolder + '/' + entry.name
      });
    } else {
      await Filesystem.rmdir({
        directory: APP_DIRECTORY,
        path: this.currentFolder + '/' + entry.name,
        recursive: true // Removes all files as well!
      });
    }
    this.loadDocuments();
  }
 
  startCopy(file) {
    this.copyFile = file;
   }
 
  async finishCopyFile(entry) {
    // Make sure we don't have any additional slash in our path
    const current = this.currentFolder != '' ? `/${this.currentFolder}` : ''
 
    const from_uri = await Filesystem.getUri({
      directory: APP_DIRECTORY,
      path: `${current}/${this.copyFile.name}`
    });
 
    const dest_uri = await Filesystem.getUri({
      directory: APP_DIRECTORY,
      path: `${current}/${entry.name}/${this.copyFile.name}`
    });
 
    await Filesystem.copy({
      from: from_uri.uri,
      to: dest_uri.uri
    });
    this.delete(this.copyFile);
    this.copyFile = null;
    this.loadDocuments();
   }
}
