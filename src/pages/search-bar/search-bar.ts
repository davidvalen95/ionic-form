import {Component, ViewChild} from '@angular/core';
import {IonicPage, NavController, NavParams, Platform, Searchbar} from 'ionic-angular';
import {BaseForm, SearchBarSetting, KeyValue} from "../../components/Forms/base-form";
import {HttpClient, HttpParams} from "@angular/common/http";
import {ApiProvider} from "../../providers/api/api";
import {AlertStatusInterface} from "../../providers/helper/helper";

/**
 * Generated class for the SearchBarPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-search-bar',
  templateUrl: 'search-bar.html',
})
export class SearchBarPage {

  public baseForm: BaseForm;
  public title: string            = "Search";
  public selectOptions: KeyValue[];
  public previousInterval: number = -1;
  public pageParam: SearchBarParam;
  public currentAlert: AlertStatusInterface;
  @ViewChild('ionSearchbar') public ionSearchbar: Searchbar

  constructor(public platform:Platform, public navCtrl: NavController, public navParams: NavParams, public httpClient: HttpClient) {
    this.baseForm = navParams.get("baseForm");
    this.pageParam = navParams.data;

    this.title    = `Search ${this.baseForm.label}`;

  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad SearchBarPage');
    setInterval(() => {
      this.ionSearchbar.setFocus()
    }, 500);
  }

  getItems(ev) {
    var currentParam: HttpParams = this.baseForm.searchBarSetting.httpParams;
    for (var key in this.baseForm.searchBarSetting.httpParamBindEvent) {
      currentParam = currentParam.set(this.baseForm.searchBarSetting.httpParamBindEvent[key], ev.target.value || "")
    }
    console.log(currentParam);
    this.httpClient.get(ApiProvider.HRM_URL + this.baseForm.searchBarSetting.url, {params: currentParam}).subscribe(response => {
      this.selectOptions = this.baseForm.searchBarSetting.processData(response);
    })


  }

  onItemClicked(selected: KeyValue) {
    this.baseForm.value = selected.value

    this.navCtrl.pop();
  }



  public leavePage() {
    this.navCtrl.pop();
  }

  ionViewWillEnter(){
    this.setHardwareBackButton();
  }
  public setHardwareBackButton(){
    this.platform.ready().then(() => {

      this.platform.registerBackButtonAction(() => {
        try{
          if(this.currentAlert.isPresent){this.currentAlert.alert.dismiss(); return;}
        }catch(exception){
          console.log(exception);
        }
        this.leavePage();

      });
    });
  }
}


export interface SearchBarParam {
  baseForm: BaseForm
}

