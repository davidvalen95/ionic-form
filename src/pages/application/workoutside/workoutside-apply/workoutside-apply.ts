import {Component, ViewChild} from '@angular/core';
import {AlertController, IonicPage, Navbar, NavController, NavParams, ToastController} from 'ionic-angular';
import {ApplyBaseInterface} from "../../../../app/app.component";
import {
  WorkoutsideDataDetailInterface,
  WorkoutsideListDataInterface, WorkoutsideListInterface,
  WorkoutsideRuleInterface
} from "../WorkoutsideApiInterface";
import {BaseForm, KeyValue} from "../../../../components/Forms/base-form";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {MatureKeyValueContainer} from "../../../../components/detail-key-value/detail-key-value";
import {HttpClient} from "@angular/common/http";
import {ApiProvider, SuccessMessageInterface, TextValueInterface} from "../../../../providers/api/api";
import {HelperProvider} from "../../../../providers/helper/helper";
import {UserProvider} from "../../../../providers/user/user";
import {RootParamsProvider} from "../../../../providers/root-params/root-params";
import {NgForm} from "@angular/forms";
import {OvertimeHistoryInterface} from "../../overtime/ApiInterface";
import {AttachmentRuleInterface} from "../../leave/ApiInterface";
import {Observable} from "rxjs/Observable";
import { SectionFloatingInputInterface} from "../../../../components/Forms/section-floating-input/section-floating-input";

/**
 * Generated class for the WorkoutsideApplyPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-workoutside-apply',
  templateUrl: 'workoutside-apply.html',
})
export class WorkoutsideApplyPage {


  public title: string;
  public segmentValue: string             = "form";
  public pageParam: WorkoutsideApplyParam = {isEditing: false, isApproval: false, isApply: true};
  public baseForms: BaseForm[]            = [];
  public approvalBaseForms: BaseForm[]    = [];
  public apiReplaySubject: { [key: string]: ReplaySubject<any> } = {};
  public attachmentValueContainer: object                        = {};
  public applyRule: WorkoutsideRuleInterface;
  public attachmentData: KeyValue[]                              = [];
  public isCanApprove: boolean                                   = false;

  public isCanAcknowledge: boolean = false;
  public isCanDelete: boolean      = false;
  public isCanSubmit: boolean      = false;

  public approvalHistoriesContainer: MatureKeyValueContainer[] = [];

  public sectionDataDetail: SectionFloatingInputInterface[] = [];
  public isDoneFetch:boolean = false;



  @ViewChild(Navbar) navbar: Navbar;
  @ViewChild("parentForm") parentForm:NgForm;
  constructor(public httpClient: HttpClient, public navCtrl: NavController, public navParams: NavParams, public alertController: AlertController, public apiProvider: ApiProvider, public helperProvider: HelperProvider, public userProvider: UserProvider, public rootParam: RootParamsProvider, public toastController: ToastController) {
    this.pageParam = navParams.data;
    this.title = this.pageParam.title || "" ;

    // console.log('applyLeaveApplicationData', this.pageParam.leaveApplicationTop , this.pageParam.leaveApplicationTop.info,  this.pageParam.leaveApplicationTop.info.available);


    var loader = this.helperProvider.presentLoadingV2("Loading");
    this.apiGetApplyRule().toPromise().then((data: WorkoutsideRuleInterface) => {
      this.applyRule      = data;
      this.applyRule.data = this.helperProvider.mergeObject(this.applyRule.data, this.applyRule.datatmp || this.applyRule.data);

      this.setupButtonLogic();

      this.setupForms();

      if (!this.pageParam.isApply) {
        this.getHistory();
      }
      if (this.pageParam.isApproval) {
        this.setupApprovalForms();
      }


    }).catch((rejected) => {
      this.helperProvider.presentToast("Error");
      console.log(rejected);
    }).finally(() => {
      loader.dismiss();
    });


  }

  setupButtonLogic() {
    this.isCanDelete  = this.pageParam.isEditing && this.applyRule.approved == 0;
    this.isCanSubmit  = this.pageParam.isApply || ( this.pageParam.isEditing && this.applyRule.approved == 0);
    this.isCanApprove = this.pageParam.isApproval && this.applyRule.data.status.toLowerCase() != 'ca' && this.applyRule.allowEdit;
  }

  ionViewDidLoad() {

    //#override back button
    this.navbar.backButtonClick = (e: UIEvent) => {
      this.leavePage();
    }
  }

  ionViewDidLeave() {

    //# broadcast event
    console.log('applyLeaveAPplicationLeave');
    // this.rootParam.broadcast.next(BroadcastType.homeLeaveApplicationOnResume);

    if (this.pageParam.onDidLeave) {
      console.log('applyLeaveAPplicationLeaveCallback');

      this.pageParam.onDidLeave();
    }

  }


  setupApprovalForms() {

    var status = new BaseForm("Status", "status")
      .setInputTypeSelect([
        {key: 'Approve', value: "AP"},
        {key: 'Reject', value: "RE"}
      ])
    if (this.applyRule.data.status.toLowerCase() != "") {
      status.value = this.applyRule.data.status.toLowerCase() != "re" ? "AP" : "RE";
    }

    var approverRemark = new BaseForm("Approver Remark", "approver_remark")
      .setInputTypeTextarea()
      .setValue(this.applyRule.data.approver_remark);

    var alertEmail = new BaseForm("trigger Alert Employee", "alert_employee")
      .setInputTypeSelect([
        {key: "Yes", value: "t"},
        {key: "No", value: "f"},
      ])
      .setValue(this.applyRule.data.alert_employee);

    alertEmail.infoBottom = "Trigger alert email notification with approver remark for employee";


    this.approvalBaseForms.push(status, approverRemark, alertEmail);

    this.setNotEditable();

  }


  setupForms() {

    var firstDayConfig = new BaseForm('apply first day',"");
    firstDayConfig.value = 'false';
    firstDayConfig.setInputTypeSelect([
      {key: "Yes",value:"true"},
      {key: "No",value:"false"},
    ]);



    var name: BaseForm = new BaseForm("Employee", "employee");
    name.value         = this.pageParam.isEditing ? this.applyRule.data.emp_id : `${this.userProvider.userSession.empId} ${this.userProvider.userSession.name}`;
    name.isReadOnly    = true;
    name.isDisabled    = true;

    var createdDate        = new BaseForm("Created Date", "");
    createdDate.isReadOnly = true;
    createdDate.value      = this.applyRule.created_date;

    var dateFrom = new BaseForm("date from", "work_date_from");
    dateFrom.setInputTypeDate({min:new Date()});
    dateFrom.value = (this.pageParam.dateFrom || BaseForm.getAdvanceDate(1, new Date(this.applyRule.data.work_date_from))).toISOString();
    dateFrom.isReadOnly = this.pageParam.isFromAbsenceRecord;
    dateFrom.changeListener.subscribe((data)=>{
      if (new Date(dateTo.value) < new Date(dateFrom.value)) {
        dateTo.value = dateFrom.value;
      } else {

        dateTo.dateSetting.min = data.value;
        this.setDataDetailSection(null,dateFrom,dateTo,firstDayConfig);
      }

    });
    // dateFrom.isReadOnly = this.pageParam.isEditing;

    var dateTo = new BaseForm("date to", "work_date_to");
    dateTo.setInputTypeDate({min:new Date()});
    dateTo.value = (this.pageParam.dateFrom || BaseForm.getAdvanceDate(1, new Date(this.applyRule.data.work_date_to))).toISOString();
    dateTo.isReadOnly = this.pageParam.isFromAbsenceRecord;

    dateTo.changeListener.subscribe((data: BaseForm) => {
      this.setDataDetailSection(null,dateFrom,dateTo,firstDayConfig);
    });


    var eventType = new BaseForm("Event Type","event_type");
    eventType.value = this.applyRule.data.event_type;
    eventType.setInputTypeSelectChain<WorkoutsideRuleInterface>(this.apiGetApplyRule(),(data:WorkoutsideRuleInterface)=>{
      var keyValue: KeyValue[] = [];


      data.cmb_event_type.forEach((currentTextValue:TextValueInterface)=>{
        if(currentTextValue.text == ""){
          return;
        }
        keyValue.push({
          key: currentTextValue.text,
          value: currentTextValue.value,
        })
      });


      return keyValue;
    });

    var workLocation = new BaseForm("work location","work_location");
    workLocation.value = this.applyRule.data.work_location;
    workLocation.changeListener.subscribe((data:BaseForm)=>{
      data.value = this.helperProvider.ucWord(data.value);
    })

    var reason = new BaseForm("reason","reason");
    reason.value = this.applyRule.data.reason;
    reason.setInputTypeTextarea();




    firstDayConfig.changeListener.subscribe((data)=>{
      this.setDataDetailSection(null,dateFrom,dateTo,firstDayConfig);

    });


    this.baseForms.push(name,createdDate, dateFrom,dateTo,eventType,workLocation,reason ,firstDayConfig);
    this.setNotEditable();

    setTimeout(()=>{
      this.setDataDetailSection(this.applyRule.detail,dateFrom,dateTo,firstDayConfig);
      this.isDoneFetch = true;
    },500)
  }

  private setNotEditable() {

    this.baseForms.forEach((currentBaseForm: BaseForm) => {
      currentBaseForm.isReadOnly = (this.isCanSubmit && !this.pageParam.isApproval) ? currentBaseForm.isReadOnly : true;
    })

    this.sectionDataDetail.forEach(currentInputSection=>{
      currentInputSection.baseForms.forEach((currentBaseForm: BaseForm) => {
        currentBaseForm.isReadOnly = (this.isCanSubmit && !this.pageParam.isApproval) ? currentBaseForm.isReadOnly : true;
      })
    })
    this.approvalBaseForms.forEach((approvalBaseForm: BaseForm) => {
      approvalBaseForm.isReadOnly = (!this.isCanApprove);
    })
  }

  formSubmitApproval(form: NgForm) {

    /*
        mobile:true
        id:102807
        approver_remark:yo u canot
        alert_employee:t
        status:RE
        sts:update
        tid:102807
        userid:MY080026
        callback:Ext.data.JsonP.callback36
        _dc:1518166076485
     */

    if (form.valid) {
      var param               = this.helperProvider.convertToJson(form);
      param["approve_remark"] = form.value.approver_remark;
      param["id"]             = this.pageParam.list.id || this.pageParam.list.tid;
      param["sts"]            = "update";
      param["tid"]            = this.pageParam.list.id || this.pageParam.list.tid;
      param["userid"]         = this.userProvider.userSession.empId;
      param["mobile"]         = "true";
      param["hospital_name"]  = "";
      console.log('formAPprovalSubmit', param);


      var url = `${ApiProvider.HRM_URL}s/WorkoutsideApplicationApproval_op`;
      this.helperProvider.showConfirmAlert("Commit Approval", () => {
        this.apiProvider.submitGet<SuccessMessageInterface>(url, param, (data: SuccessMessageInterface) => {
          this.navCtrl.pop();
          this.helperProvider.presentToast(data.message || "");
        })
      })
    } else {
      this.helperProvider.showAlert("Please check field(s) mark in red", "");
    }


  }

  formSubmit(form: NgForm) {

    var test: object = {};
    if (form.valid) {
      console.log('formvalue', form.value);
      var json = this.helperProvider.convertToJson(form);
      console.log('jsonraw', json);

      json["emp_id"] = this.applyRule.data.emp_id;
      // json["half_date"]  = form.value.leave_date_from;
      json["sts"]    = this.pageParam.isEditing ? "update" : "save";
      json["tid"]    = this.pageParam.isEditing ? this.pageParam.list.id : this.userProvider.userSession.empId;
      json["userid"] = this.userProvider.userSession.empId;
      json["mobile"] = true;
      json["id"]     = this.pageParam.isEditing ? this.pageParam.list.id : -1;
      json           = this.helperProvider.convertIsoToServerDate(json, ["work_date_from","work_date_to"]);


      json = this.helperProvider.mergeObject(json, this.attachmentValueContainer);
      json = this.removeWrongDate(json);
      console.log('formSUbmit', json, this.attachmentValueContainer);


      // this.httpClient.post(url, )
      this.helperProvider.showConfirmAlert("Submit leave application?", () => {

        this.apiExecuteSubmitApplication(json);
      });
    } else {
      this.helperProvider.showAlert("Please check field(s) mark in red", "");
    }

  }


  formDelete() {
    var json       = [];
    json["sts"]    = "delete";
    json["tid"]    = this.pageParam.list.id;
    json["id"]     = this.pageParam.list.id;
    json["userid"] = this.userProvider.userSession.empId;
    json["mobile"] = true;
    this.helperProvider.showConfirmAlert("Delete this leave application?", () => {
      this.apiExecuteSubmitApplication(json);
    });
  }


  public leavePage() {

    this.helperProvider.showConfirmAlert("leave this page", () => {
      this.navCtrl.pop({}, () => {

      });

    })
  }


  public getHistory() {
    if (this.applyRule.history) {

      this.applyRule.history.forEach((data: OvertimeHistoryInterface, index) => {
        var keyValues: KeyValue[] = [];
        for (var key in data) {
          var value = data[key];
          keyValues.push({
            key: key,
            value: value,
          });
        }


        this.approvalHistoriesContainer.push({
          isOpen: true,
          name: `${index + 1} ${data.status}`,
          keyValue: keyValues
        })
      })
    }
  }

  private apiGetApplyRule() {

    // http://hrms.dxn2u.com:8888/hrm_test2/s/OvertimeApplication_top?mobile=true&cmd=add&tid=MY080127

//
    if (!this.apiReplaySubject.applyRule) {
      this.apiReplaySubject.applyRule = new ReplaySubject(0);

      var url    = `${ApiProvider.HRM_URL}${this.pageParam.isApproval ? "s/WorkoutsideApplicationApproval_top" : "s/WorkoutsideApplication_top"}`;
      var params = {
        mobile: "true",
        cmd: this.pageParam.isEditing ? "edit" : "add",
        tid: this.pageParam.isEditing ? this.pageParam.list.id : this.userProvider.userSession.empId,
        user_id: this.userProvider.userSession.empId,
      }


      this.httpClient.get<WorkoutsideRuleInterface>(url, {
        withCredentials: true,
        params: params
      }).subscribe(this.apiReplaySubject.applyRule);
    }


    return this.apiReplaySubject.applyRule;


  }

  private apiGetAtachmentRule(leaveType): Observable<AttachmentRuleInterface> {
    // http://hrms.dxn2u.com:8888/hrm_test2/s/LeaveApplicationAjax?reqtype=req_attach&ct_id=MY&leave_type=AL
    if (!leaveType) {
      return;
    }
    var url = `${ApiProvider.HRM_URL}s/LeaveApplicationAjax`;


    var param = {
      reqtype: "req_attach",
      ct_id: this.userProvider.userSession.ct_id,
      leave_type: `${leaveType}`,
    }

    return this.httpClient.get<AttachmentRuleInterface>(url, {params: param, withCredentials: true});
  }


  private apiExecuteSubmitApplication(json: object): void {

    // http://hrms.dxn2u.com:8888/hrm_test2/s/LeaveApplicationAjax?reqtype=total_day&emp_id=MY080127&leave_type=EL&leave_date_from=22%20Feb%202018&leave_date_to=22%20Feb%202018&halfday_date=22%20Feb%202018&exclude_dt=&id=-1&ct_id=MY&callback=Ext.data.JsonP.callback56&_dc=1517798772579

    var url = `${ApiProvider.HRM_URL}s/WorkoutsideApplication_op`;
    //
    // this.httpClient.post(url,body)

    this.apiProvider.submitGet<SuccessMessageInterface>(url, json, (response: SuccessMessageInterface) => {

      var message = response.message || "Cannot retrieve message";
      if (response.success) {
        this.helperProvider.presentToast(message);

        setTimeout(() => {
          this.navCtrl.pop();

        }, 500)
      } else {
        this.helperProvider.showAlert(message);
      }

    });


  }


  private attachmentToggle(rule: AttachmentRuleInterface, baseForms: BaseForm[]) {

    console.log('attachmentToggle', rule, baseForms);
    for (var k in baseForms) {
      var key                = +k;// to number
      var keyPlusOne         = key + 1;
      var isVisible: boolean = this.helperProvider.parseBoolean(rule[`reqAttach${keyPlusOne}`] || false);
      console.log(keyPlusOne, isVisible, typeof isVisible);
      baseForms[key].isHidden = !isVisible;
      baseForms[key].setIsRequired(isVisible);
      baseForms[key].label = rule[`reqAttachDesc${keyPlusOne}`] || `Attachment ${keyPlusOne}`;

      if (key == 3) {
        baseForms[key].rules.isRequired = false;
      }

      if (rule[`reqAttach${keyPlusOne}`]) {
      }
    }
  }


  private setAttachmentData(data: WorkoutsideRuleInterface, fileForms: BaseForm[]) {


    fileForms.forEach((currentForm: BaseForm, index) => {
      var i = index + 1;

      var currentUrl: string = data[`attachment${i}url`];

      if (!currentUrl) {
        return;
      }
      currentForm.setFileAttachmentInfo(data.data[`attachment${i}`], `${ApiProvider.BASE_URL}${currentUrl}`);
    });


  }

  private setDataDetailSection(dataDetail:WorkoutsideDataDetailInterface[],dateFrom:BaseForm,dateTo:BaseForm,firstDayConfig){



    //# range 2 form
    var difDayPlusOne = this.helperProvider.getDifferentDay(dateFrom.value,dateTo.value) + 1;
    if(dataDetail == null) {
      dataDetail = [];
      for(var i = 0 ; i<difDayPlusOne ; i++){



        var advancedDate:string = this.helperProvider.getServerDateFormat(BaseForm.getAdvanceDate((i), new Date(dateFrom.value)));

        dataDetail.push({
          work_date: advancedDate,
          time_in: "07:00",
          rest_out: "12:00",
          rest_in: "13:00",
          time_out: "18:00",
        })
      }
    }




    this.sectionDataDetail.splice(0, this.sectionDataDetail.length);


    dataDetail.forEach((currentDataDetail:WorkoutsideDataDetailInterface,index)=>{




      var timeIn = new BaseForm("Time In",`time_in${index}`);
      timeIn.value = currentDataDetail.time_in;
      timeIn.setInputTypeTime();
      var restOut = new BaseForm("rest Out",`rest_out${index}`);
      restOut.setInputTypeTime();
      restOut.setIsRequired(false);
      restOut.value = currentDataDetail.rest_out;

      var restIn = new BaseForm("rest In",`rest_in${index}`);
      restIn.setInputTypeTime();
      restIn.setIsRequired(false);
      restIn.value = currentDataDetail.rest_in;

      var timeOut = new BaseForm("time Out",`time_out${index}`);
      timeOut.setInputTypeTime();
      timeOut.value = currentDataDetail.time_out

      var workDate = new BaseForm("",`work_date${index}`);
      workDate.isHidden = true;
      workDate.value = currentDataDetail.work_date;

      //# siapin sectionFloatings
      var section: SectionFloatingInputInterface = {
        name: currentDataDetail.work_date,
        description: "",
        baseForms: [timeIn,restOut,restIn,timeOut,workDate],
        isOpen:true,
      }



      //# other than  0 listen to 0
      this.sectionDataDetail.push(section);
      if(index>0 && firstDayConfig.value === "true"){
        var firstTimein = this.sectionDataDetail[0].baseForms[0]
        firstTimein.changeListener.subscribe((data)=>{
          timeIn.value = data.value
        });

        var firstRestOut = this.sectionDataDetail[0].baseForms[1]
        firstRestOut.changeListener.subscribe((data)=>{
          restOut.value = data.value
        });

        var firstRestIn= this.sectionDataDetail[0].baseForms[2]
        firstRestIn.changeListener.subscribe((data)=>{
          restIn.value = data.value
        });

        var firstTimeOut = this.sectionDataDetail[0].baseForms[3]
        firstTimeOut.changeListener.subscribe((data)=>{
          timeOut.value = data.value
        });
      }


    })


    // this.dataDetailRule.sectionDataDetail = sectionContainer;
    this.setNotEditable();

  }

  private removeWrongDate(originJson:object){

    var json = Object.assign({},originJson);

    var indexOf:string[] = ["work_date","time_in","rest_in","rest_out","time_out"]

    console.log("beforeRemoveWrongDate",originJson);
    //# delete any form that contains
    for (var key in json){
      indexOf.forEach((string)=>{
        if(key.indexOf(string)>=0 && (key.indexOf("work_date_from") == -1) && key.indexOf("work_date_to") == -1){
          delete json[key];
        }
      })
    }


    //# copy to json
    this.sectionDataDetail.forEach((floatingInput:SectionFloatingInputInterface)=>{
      floatingInput.baseForms.forEach((currentBaseForm:BaseForm)=>{
        json[currentBaseForm.name] = currentBaseForm.value;
      })
    })

    return json;



  }


}


export interface WorkoutsideApplyParam extends ApplyBaseInterface<WorkoutsideListDataInterface> {
  dateFrom?:Date;

}


