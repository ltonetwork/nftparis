import {useEffect, useState} from 'react';
import {Box, Button, Link, Typography} from "@mui/material";
import PackagesFab from "./components/PackagesFab";
import IDBService from "./services/IDB.service";
import {TypedPackage} from "./interfaces/TypedPackage";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import LTOService from "./services/LTO.service";
import Sidebar from "./components/Sidebar";
import LocalStorageService from "./services/LocalStorage.service";
import SessionStorageService from "./services/SessionStorage.service";
import OwnableService from "./services/Ownable.service";
import If from "./components/If";
import PackageService, {HAS_EXAMPLES} from "./services/Package.service";
import Grid from "@mui/material/Unstable_Grid2";
import * as React from "react";
import Ownable from "./components/Ownable";
import {EventChain} from "@ltonetwork/lto";
import HelpDrawer from "./components/HelpDrawer";
import AppToolbar from "./components/AppToolbar";
import AlertDialog from "./components/AlertDialog";
import {AlertColor} from "@mui/material/Alert/Alert";
import ownableErrorMessage from "./utils/ownableErrorMessage";
import Overlay from "./components/Overlay";
import ConfirmDialog from "./components/ConfirmDialog";
import { SnackbarProvider, enqueueSnackbar } from 'notistack';
import {TypedOwnableInfo} from "./interfaces/TypedOwnableInfo";
import Tabs, { tabsClasses } from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';


export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(!LTOService.isUnlocked());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPackages, setShowPackages] = React.useState(false);
  const [address, setAddress] = useState(LTOService.address);
  const [ownables, setOwnables] = useState<Array<{chain: EventChain, package: string, keywords:string[]}>>([]);
  const [consuming, setConsuming] = useState<{chain: EventChain, package: string, info: TypedOwnableInfo}|null>(null);
  const [alert, setAlert] = useState<{title: string, message: React.ReactNode, severity: AlertColor}|null>(null);
  const [value, setValue] = React.useState(0);
  const [ownablesFromStorage, setOwnablesFromStorage] = useState<Array<{chain: EventChain, package: string, keywords:string[]}>>([]);
  const [confirm, setConfirm] =
    useState<{title: string, message: React.ReactNode, severity?: AlertColor, ok?: string, onConfirm: () => void}|null>(null);

  useEffect(() => {
    IDBService.open()
      .then(() => OwnableService.loadAll())
      .then(ownables => {
        setOwnablesFromStorage(ownables);
        setOwnables(ownables);
    })
    .then(() => setLoaded(true))
  }, []);

  const showError = (title: string, message: string) => {
    setAlert({severity: "error", title, message});
  }

  const onLogin = () => {
    setShowLogin(false);
    setAddress(LTOService.address);
  }

  const logout = () => {
    setShowSidebar(false);
    LTOService.lock();
    setShowLogin(true);
  }

  const forge = async (pkg: TypedPackage) => {
    const chain = OwnableService.create(pkg);
    setOwnables([...ownables, {chain, package: pkg.cid, keywords: pkg.keywords || []}]);
    setShowPackages(false);
    enqueueSnackbar(`${pkg.title} forged`, {variant: "success"});
  }

  const deleteOwnable = (id: string, packageCid: string) => {
    const pkg = PackageService.info(packageCid);

    setConfirm({
      severity: "error",
      title: "Confirm delete",
      message: <span>Are you sure you want to delete this <em>{pkg.title}</em> Ownable?</span>,
      ok: "Delete",
      onConfirm: async () => {
        setOwnables(current => current.filter(ownable => ownable.chain.id !== id));
        await OwnableService.delete(id);
        enqueueSnackbar(`${pkg.title} deleted`);
      }
    });
  }

  const canConsume = async (consumer: {chain: EventChain, package: string}): Promise<boolean> => {
    try {
      return !!consuming?.info && await OwnableService.canConsume(consumer, consuming!.info);
    } catch (e) {
      console.error(e, (e as any).cause);
      return false;
    }
  }

  const consume = (consumer: EventChain, consumable: EventChain) => {
    if (consumer.id === consumable.id) return;

    OwnableService.consume(consumer, consumable)
      .then(() => {
        setConsuming(null);
        setOwnables(ownables => [...ownables]);
        enqueueSnackbar("Consumed", {variant: "success"});
      })
      .catch(error => showError("Consume failed", ownableErrorMessage(error)));
  }

  const reset = async () => {
    setShowSidebar(false);
    if (ownables.length === 0) return;

    setConfirm({
      severity: "error",
      title: "Confirm delete",
      message: <span>Are you sure you want to delete <strong>all Ownables</strong>?</span>,
      ok: "Delete all",
      onConfirm: async () => {
        setOwnables([]);
        await OwnableService.deleteAll();
        enqueueSnackbar("All Ownables are deleted");
      }
    });
  }

  const factoryReset = async () => {
    setShowSidebar(false);

    setConfirm({
      severity: "error",
      title: "Factory reset",
      message: <span>Are you sure you want to delete all Ownables, all packages and your account? <strong>This is a destructive action.</strong></span>,
      ok: "Delete everything",
      onConfirm: async () => {
        setLoaded(false);

        LocalStorageService.clear();
        SessionStorageService.clear();
        await IDBService.deleteDatabase();

        window.location.reload();
      }
    });
  }

  const handleChange = async (event: React.SyntheticEvent, newValue: number) => {
    const keyword = ['', 'consumable', 'ownable', 'usable', 'moveable', 'soundable'][newValue];
    setValue(newValue);
    console.log("new value", newValue, "keyword", keyword);
    if (keyword === '') {
      setOwnables(ownablesFromStorage);
    } else {
      const filteredOwnables = await (await Promise.all(ownablesFromStorage.map(async (ownable) => {
        const pkg = await PackageService.info(ownable.package);
        console.log("pkg", pkg);
        console.log("pkg.keywords", pkg.keywords);
        if (pkg.keywords?.includes(keyword)) {
          console.log("keyword included");
          return { chain: ownable.chain, package: ownable.package, keywords: pkg.keywords };
        }
        return null;
      }))).filter((ownable: {chain: EventChain, package: string, keywords:string[]} | null) => ownable !== null);
      setOwnables(filteredOwnables as { chain: EventChain, package: string, keywords: string[] }[]);
    }
  };

  return <>
    <AppToolbar onMenuClick={() => setShowSidebar(true)} />
    <Tabs
        value={value}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons
        aria-label="visible arrows tabs example"
        sx={{
          [`& .${tabsClasses.scrollButtons}`]: {
            '&.Mui-disabled': { opacity: 0.3 },
          },
          width: {
            xs: '100%', // full width on extra small screens
            sm: '100%', // full width on small screens
            md: '60%',  // half width on medium screens and up
          },
          margin: 'auto', // center the tabs on medium screens and up
        }}
      >
        <Tab label="All" />
        <Tab label="Consumables" />
        <Tab label="Ownables" />
        <Tab label="Usables" />
        <Tab label="Moveables" />
        <Tab label="Soundable" />
    </Tabs>
    <If condition={ownables.length === 0}>
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: -1 }}
      >
        <Grid xs={10}>
          <Typography variant="h3" color="text.primary" textAlign="center">Let's get started!</Typography>
          <Typography variant="subtitle1" color="text.secondary" textAlign="center" sx={{mt: 2}}>
            Read <Link href="https://docs.ltonetwork.com/ownables/what-are-ownables" target="_blank">the documentation</Link> to learn how to issue an Ownable
            <If condition={HAS_EXAMPLES}><br />or try one of <Link component="button" onClick={() => setShowPackages(true)} style={{fontSize: 'inherit'}}>the examples</Link></If>.
          </Typography>
        </Grid>
      </Grid>
    </If>

    <Grid container sx={{maxWidth: 1400, margin: 'auto', mt: 2}} columnSpacing={6} rowSpacing={4}>
      { ownables.map(({chain, package: packageCid}) =>
        <Grid key={chain.id} xs={12} sm={6} md={4} sx={{position: 'relative'}}>
          <Ownable
            chain={chain}
            packageCid={packageCid}
            selected={consuming?.chain.id === chain.id}
            onDelete={() => deleteOwnable(chain.id, packageCid)}
            onConsume={(info) => setConsuming({chain, package: packageCid, info})}
            onError={showError}
          >
            <If condition={consuming?.chain.id === chain.id}><Overlay zIndex={1000} /></If>
            <If condition={consuming !== null && consuming.chain.id !== chain.id}>
              <Overlay
                zIndex={1000}
                disabled={canConsume({chain, package: packageCid}).then(can => !can)}
                onClick={() => consume(chain, consuming!.chain)}
              />
            </If>
          </Ownable>
        </Grid>
      )}
    </Grid>

    <PackagesFab
      open={showPackages}
      onOpen={() => setShowPackages(true)}
      onClose={() => setShowPackages(false)}
      onSelect={forge}
      onError={showError}
    />

    <Sidebar
      open={showSidebar}
      onClose={() => setShowSidebar(false)}
      onLogout={logout}
      onReset={reset}
      onFactoryReset={factoryReset}
    />
    <LoginDialog key={address} open={loaded && showLogin} onLogin={onLogin} />

    <HelpDrawer open={consuming !== null}>
      <Typography component="span" sx={{fontWeight: 700}}>
        Select which Ownable should consume this <em>{consuming ? PackageService.info(consuming.package).title : ''}</em>
      </Typography>
      <Box>
        <Button sx={theme => ({color: theme.palette.primary.contrastText})} onClick={() => setConsuming(null)}>Cancel</Button>
      </Box>
    </HelpDrawer>

    <SnackbarProvider />
    <AlertDialog open={alert !== null} onClose={() => setAlert(null)} {...alert!}>{alert?.message}</AlertDialog>
    <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} {...confirm!}>{confirm?.message}</ConfirmDialog>
    <Loading show={!loaded} />
  </>
}
