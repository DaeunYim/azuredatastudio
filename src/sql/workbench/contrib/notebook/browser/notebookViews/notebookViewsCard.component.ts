/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as DOM from 'vs/base/browser/dom';
import { Component, OnInit, Input, ViewChild, TemplateRef, ElementRef, Inject, Output, EventEmitter, ChangeDetectorRef, forwardRef } from '@angular/core';
import { CellExecutionState, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { DEFAULT_VIEW_CARD_HEIGHT, DEFAULT_VIEW_CARD_WIDTH } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { CellChangeEventType, INotebookView, INotebookViewCellMetadata } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { RunCellAction, HideCellAction, ViewCellToggleMoreActions } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { cellBorder, notebookToolbarSelectBackground } from 'sql/platform/theme/common/colorRegistry';
import { AngularDisposable } from 'sql/base/browser/lifecycle';

@Component({
	selector: 'view-card-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsCard.component.html'))
})
export class NotebookViewsCardComponent extends AngularDisposable implements OnInit {
	private _actionbar: Taskbar;
	private _metadata: INotebookViewCellMetadata;
	private _activeView: INotebookView;
	private _executionState: CellExecutionState;

	public _cellToggleMoreActions: ViewCellToggleMoreActions;

	@Input() cell: ICellModel;
	@Input() model: NotebookModel;
	@Input() views: NotebookViewsExtension;
	@Input() ready: boolean;
	@Output() onChange: EventEmitter<any> = new EventEmitter();

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('item', { read: ElementRef }) private _item: ElementRef;
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
	) {
		super();
	}

	ngOnInit() {
		this.initActionBar();
		this._register(this.cell.onExecutionStateChange(e => this.executionState = e));
	}

	ngOnChanges() {
		if (this.views) {
			this._activeView = this.views.getActiveView();
			this._metadata = this.views.getCellMetadata(this.cell);
		}
		this.detectChanges();
	}

	ngAfterContentInit() {
		if (this.views) {
			this._activeView = this.views.getActiveView();
			this._metadata = this.views.getCellMetadata(this.cell);
		}
		this.detectChanges();
	}

	initActionBar() {
		if (this._actionbarRef) {
			let taskbarContent: ITaskbarContent[] = [];
			let context = new CellContext(this.model, this.cell);

			this._actionbar = new Taskbar(this._actionbarRef.nativeElement);
			this._actionbar.context = { target: this._actionbarRef.nativeElement };

			if (this.cell.cellType === CellTypes.Code) {
				let runCellAction = this._instantiationService.createInstance(RunCellAction, context);
				taskbarContent.push({ action: runCellAction });
			}

			let hideButton = new HideCellAction(this.hide, this);
			taskbarContent.push({ action: hideButton });

			let moreActionsContainer = DOM.$('li.action-item');
			this._cellToggleMoreActions = this._instantiationService.createInstance(ViewCellToggleMoreActions);
			this._cellToggleMoreActions.onInit(moreActionsContainer, context);
			taskbarContent.push({ element: moreActionsContainer });

			this._actionbar.setContent(taskbarContent);
		}

	}

	ngAfterViewInit() {
		this.initActionBar();
		this.detectChanges();
	}

	get elementRef(): ElementRef {
		return this._item;
	}

	changed(event: CellChangeEventType) {
		this.onChange.emit({ cell: this.cell, event: event });
	}

	get modal(): boolean {
		return this.awaitingInput;
	}

	detectChanges() {
		this._changeRef.detectChanges();
	}

	public selectCell(cell: ICellModel, event?: Event) {
		if (event) {
			event.stopPropagation();
		}
		if (!this.model.activeCell || this.model.activeCell.id !== cell.id) {
			this.model.updateActiveCell(cell);
			this.changed('active');
		}
	}

	public set executionState(state: CellExecutionState) {
		if (this._executionState !== state) {
			this._executionState = state;
			this.detectChanges();
			this.changed('execution');
		}
	}

	public get executionState(): CellExecutionState {
		return this._executionState;
	}

	public hide(): void {
		this.changed('hide');
	}

	public get data(): any {
		return this._metadata?.views?.find(v => v.guid === this._activeView.guid);
	}

	public get width(): number {
		return this.data?.width ? this.data.width : DEFAULT_VIEW_CARD_WIDTH;
	}

	public get height(): number {
		return this.data?.height ? this.data.height : DEFAULT_VIEW_CARD_HEIGHT;
	}

	public get x(): number {
		return this.data?.x;
	}

	public get y(): number {
		return this.data?.y;
	}

	public get display(): boolean {
		if (!this._metadata || !this._activeView || this.awaitingInput) {
			return true;
		}

		return !this.data?.hidden;
	}

	public get awaitingInput(): boolean {
		return this.cell.future && this.cell.future.inProgress && (this.cell.outputs.length > 0 || this.cell.stdInVisible);
	}

	public get showActionBar(): boolean {
		return this.cell.active;
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const cellBorderColor = theme.getColor(cellBorder);
	if (cellBorderColor) {
		collector.addRule(`.notebookEditor .notebook-cell.active .actionbar { border-color: ${cellBorderColor};}`);
		collector.addRule(`.notebookEditor .notebook-cell.active .actionbar .codicon:before { background-color: ${cellBorderColor};}`);
	}

	// Cell toolbar background
	const notebookToolbarSelectBackgroundColor = theme.getColor(notebookToolbarSelectBackground);
	if (notebookToolbarSelectBackgroundColor) {
		collector.addRule(`.notebookEditor .notebook-cell.active .actionbar { background-color: ${notebookToolbarSelectBackgroundColor};}`);
	}
});
