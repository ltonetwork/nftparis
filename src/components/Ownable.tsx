import {Component, createRef, ReactNode, RefObject} from "react";
import {Paper, Tooltip} from "@mui/material";
import OwnableFrame from "./OwnableFrame";
import {Cancelled, connect as rpcConnect} from "simple-iframe-rpc";
import PackageService from "../services/Package.service";
import {Binary, EventChain} from "@ltonetwork/lto";
import OwnableActions from "./OwnableActions";
import OwnableInfo from "./OwnableInfo";
import OwnableService, {OwnableRPC, StateDump} from "../services/Ownable.service";
import {TypedMetadata, TypedOwnableInfo} from "../interfaces/TypedOwnableInfo";
import isObject from "../utils/isObject";
import ownableErrorMessage from "../utils/ownableErrorMessage";
import TypedDict from "../interfaces/TypedDict";
import {TypedPackage} from "../interfaces/TypedPackage";
import Overlay, {OverlayBanner} from "./Overlay";
import LTOService from "../services/LTO.service";
import asDownload from "../utils/asDownload";
import shortId from "../utils/shortId";
import If from "./If";
import EventChainService from "../services/EventChain.service";

interface OwnableProps {
  chain: EventChain;
  packageCid: string;
  selected: boolean;
  onDelete: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onError: (title: string, message: string) => void;
  children?: ReactNode;
}

interface OwnableState {
  initialized: boolean;
  applied: Binary;
  stateDump: StateDump;
  info?: TypedOwnableInfo;
  metadata: TypedMetadata;
}

export default class Ownable extends Component<OwnableProps, OwnableState> {
  private readonly pkg: TypedPackage;
  private readonly iframeRef: RefObject<HTMLIFrameElement>;
  private busy = false;

  constructor(props: OwnableProps) {
    super(props);

    this.pkg = PackageService.info(props.packageCid);
    this.iframeRef = createRef();

    this.state = {
      initialized: false,
      applied: new EventChain(this.chain.id).latestHash,
      stateDump: [],
      metadata: { name: this.pkg.title, description: this.pkg.description },
    };
  }

  get chain(): EventChain {
    return this.props.chain;
  }

  get isTransferred(): boolean {
    return !!this.state.info && this.state.info.owner !== LTOService.address;
  }

  private async transfer(to: string): Promise<void> {
    await this.execute({transfer: {to: to}});

    const zip = await OwnableService.zip(this.chain);
    const content = await zip.generateAsync({type:"blob"});

    const filename = `ownable.${shortId(this.chain.id, 12, '')}.${shortId(this.chain.state.base58, 8, '')}.zip`;

    asDownload(content, filename);
  }

  private async refresh(stateDump?: StateDump): Promise<void> {
    if (!stateDump) stateDump = this.state.stateDump;

    if (this.pkg.hasWidgetState) await OwnableService.rpc(this.chain.id).refresh(stateDump);

    const info = await OwnableService.rpc(this.chain.id).query({get_info: {}}, stateDump) as TypedOwnableInfo;
    const metadata = this.pkg.hasMetadata
      ? await OwnableService.rpc(this.chain.id).query({get_metadata: {}}, stateDump) as TypedMetadata
      : this.state.metadata;

    this.setState({info, metadata});
  }

  private async apply(partialChain: EventChain): Promise<void> {
    if (this.busy) return;
    this.busy = true;

    const stateDump =
      await EventChainService.getStateDump(this.chain.id, partialChain.state) || // Use stored state dump if available
      await OwnableService.apply(partialChain, this.state.stateDump);

    await this.refresh(stateDump);

    this.setState({applied: this.chain.latestHash, stateDump});
    this.busy = false;
  }

  async onLoad(): Promise<void> {
    if (!this.pkg.isDynamic) {
      await OwnableService.initStore(this.chain, this.pkg.cid);
      return;
    }

    const iframeWindow = this.iframeRef.current!.contentWindow;
    const rpc = rpcConnect<Required<OwnableRPC>>(window, iframeWindow, "*", {timeout: 5000});

    try {
      await OwnableService.init(this.chain, this.pkg.cid, rpc);
      this.setState({initialized: true});
    } catch (e) {
      if (e instanceof Cancelled) return;
      this.props.onError("Failed to forge Ownable", ownableErrorMessage(e));
    }
  }

  private async execute(msg: TypedDict): Promise<void> {
    let stateDump: StateDump;

    try {
      stateDump = await OwnableService.execute(this.chain, msg, this.state.stateDump);
    } catch (error) {
      this.props.onError("The Ownable returned an error", ownableErrorMessage(error));
      return;
    }

    await OwnableService.store(this.chain, stateDump);

    await this.refresh(stateDump);
    this.setState({applied: this.chain.latestHash, stateDump});
  }

  private windowMessageHandler = async (event: MessageEvent) => {
    if (!isObject(event.data) || !('ownable_id' in event.data) || event.data.ownable_id !== this.chain.id) return;
    if (this.iframeRef.current!.contentWindow !== event.source)
      throw Error("Not allowed to execute msg on other Ownable");

    await this.execute(event.data.msg);
  }

  async componentDidMount() {
    window.addEventListener("message", this.windowMessageHandler);
  }

  shouldComponentUpdate(nextProps: OwnableProps, nextState: OwnableState): boolean {
    return nextState.initialized;
  }

  async componentDidUpdate(_: OwnableProps, prev: OwnableState): Promise<void> {
    const partial = this.chain.startingAfter(this.state.applied);

    if (partial.events.length > 0)
      await this.apply(partial);
    else if (this.state.initialized !== prev.initialized || this.state.applied.hex !== prev.applied.hex)
      await this.refresh();
  }

  componentWillUnmount() {
    OwnableService.clearRpc(this.chain.id);
    window.removeEventListener("message", this.windowMessageHandler);
  }

  render() {
    return (
      <Paper sx={{
        aspectRatio: "1/1",
        position: 'relative',
        animation: this.props.selected ? "bounce .4s ease infinite alternate" : ''
      }}>
        <OwnableInfo
          sx={{position: 'absolute', left: 5, top: 5, zIndex: 10}}
          chain={this.chain}
          metadata={this.state.metadata}
        />
        <OwnableActions
          sx={{position: 'absolute', right: 5, top: 5, zIndex: 10}}
          isConsumable={this.pkg.isConsumable && !this.isTransferred}
          isTransferable={this.pkg.isTransferable && !this.isTransferred}
          onDelete={this.props.onDelete}
          onConsume={() => !!this.state.info && this.props.onConsume(this.state.info)}
          onTransfer={address => this.transfer(address)}
        />
        <OwnableFrame
          id={this.chain.id}
          packageCid={this.pkg.cid}
          isDynamic={this.pkg.isDynamic}
          iframeRef={this.iframeRef}
          onLoad={() => this.onLoad()}
        />
        {this.props.children}
        <If condition={this.isTransferred}>
          <Tooltip title="You're unable to interact with this Ownable, because it has been transferred to a different account." followCursor>
            <Overlay sx={{backgroundColor: "rgba(255, 255, 255, 0.8)"}}>
              <OverlayBanner>Transferred</OverlayBanner>
            </Overlay>
          </Tooltip>
        </If>
      </Paper>
    )
  }
}
